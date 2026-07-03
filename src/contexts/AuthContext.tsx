import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileFetchingRef = useRef(false);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('fetchProfile error:', error.message);
        return null;
      }
      const p = data as Profile | null;
      setProfile(p);
      return p;
    } catch (err) {
      console.error('fetchProfile exception:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Get initial session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // IMPORTANT: Never await inside onAuthStateChange — it holds the auth token lock.
      // Defer any async work via setTimeout to avoid lock conflicts.
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user && !profileFetchingRef.current) {
        // Defer profile fetch outside the lock context
        setTimeout(() => {
          fetchProfile(session.user!.id);
        }, 0);
      } else if (!session) {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null; role?: string }> => {
    profileFetchingRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data.user) {
        const p = await fetchProfile(data.user.id);
        return { error: null, role: p?.role ?? undefined };
      }
      return { error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      return { error: msg };
    } finally {
      profileFetchingRef.current = false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  requiredRole?: 'vendor' | 'admin';
}

export const ProtectedRoute: React.FC<Props> = ({ children, requiredRole }) => {
  const { user, profile, loading } = useAuth();

  // Show spinner while initial auth state is being resolved
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not authenticated at all
  if (!user) return <Navigate to="/login" replace />;

  // User is authenticated but profile is still loading — show spinner instead of bouncing to login
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profile.status === 'inactive') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-destructive">Account Deactivated</h2>
          <p className="mt-2 text-muted-foreground">Contact administrator for access.</p>
        </div>
      </div>
    );
  }

  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/vendor'} replace />;
  }

  return <>{children}</>;
};

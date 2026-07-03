import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Droplets, Eye, EyeOff, ShieldCheck, Truck, Copy } from 'lucide-react';
import { toast } from 'sonner';

const DEMO_CREDENTIALS = [
  { label: 'Vendor', email: 'vendor@wdms.local', password: 'Vendor@1234', role: 'vendor' as const },
];

const LoginPage: React.FC = () => {
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (profile) {
      navigate(profile.role === 'admin' ? '/admin' : '/vendor', { replace: true });
    }
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error, role } = await signIn(email.trim().toLowerCase(), password);
      if (error) {
        toast.error('Login failed', { description: error });
        return;
      }
      // Navigate immediately using returned role
      navigate(role === 'admin' ? '/admin' : '/vendor', { replace: true });
    } catch (err) {
      toast.error('Login failed', { description: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setEmail(cred.email);
    setPassword(cred.password);
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-sidebar p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Droplets className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-sidebar-foreground">WDMS</span>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold leading-tight text-white">
              Water Distribution<br />Management System
            </h1>
            <p className="mt-4 text-lg text-sidebar-foreground/70">
              Streamlined water bottle delivery operations with digital signatures,
              real-time tracking, and comprehensive reporting.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Truck, label: 'Vendor Portal', desc: 'Complete delivery routes and capture signatures' },
              { icon: ShieldCheck, label: 'Admin Portal', desc: 'Review, approve and generate official waybills' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-lg bg-sidebar-accent p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sidebar-foreground">{item.label}</p>
                  <p className="text-sm text-sidebar-foreground/60">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Demo credentials on left panel */}
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Demo Credentials
            </p>
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.role}
                type="button"
                onClick={() => fillCredentials(cred)}
                className="w-full flex items-center justify-between rounded-md bg-sidebar/60 px-3 py-2 text-left hover:bg-sidebar transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-sidebar-foreground">{cred.label}</p>
                  <p className="text-xs text-sidebar-foreground/50">{cred.email}</p>
                </div>
                <Copy className="h-3.5 w-3.5 text-sidebar-foreground/40" />
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/40">
          Secure, production-grade logistics management
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-8 bg-background">
        <div className="w-full max-w-md space-y-4">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Droplets className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-foreground">Water Distribution</p>
              <p className="text-xs text-muted-foreground">Management System</p>
            </div>
          </div>

          <Card className="border-border shadow-card">
            <CardHeader className="pb-4">
              <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
              <p className="text-sm text-muted-foreground">
                Enter your credentials to access the system
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Mobile demo credentials */}
          <div className="lg:hidden rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Demo Accounts — tap to fill
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_CREDENTIALS.map((cred) => (
                <button
                  key={cred.role}
                  type="button"
                  onClick={() => fillCredentials(cred)}
                  className="flex flex-col items-start rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium text-foreground">{cred.label}</span>
                  <span className="text-xs text-muted-foreground truncate w-full">{cred.email}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            New vendor accounts are created by the Admin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  Truck,
  History,
  Wrench,
  DropletsIcon,
  LogOut,
  Menu,
  Droplets,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const vendorNavItems = [
  { label: 'Dashboard', path: '/vendor', icon: LayoutDashboard, exact: true },
  { label: 'New Delivery', path: '/vendor/new-delivery', icon: Truck },
  { label: 'Sanitisation', path: '/vendor/sanitisation', icon: DropletsIcon },
  { label: 'Descaling', path: '/vendor/descaling', icon: Wrench },
  { label: 'History', path: '/vendor/history', icon: History },
];

const NavItems: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
    onClose?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-wider text-sidebar-foreground">
              Water Distribution
            </p>
            <p className="text-xs text-sidebar-foreground/60">Management System</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          Vendor Portal
        </p>
        <nav className="space-y-1">
          {vendorNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="h-3 w-3 opacity-40" />
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="mb-3 rounded-md bg-sidebar-accent px-3 py-2">
          <p className="text-xs text-sidebar-foreground/60">Logged in as</p>
          <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name || profile?.email}</p>
          <p className="text-xs text-sidebar-foreground/50">Vendor</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 border border-sidebar-border/60 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export const VendorLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <NavItems />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar">
              <NavItems onClose={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 min-w-0">
            <Droplets className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">Water Distribution</span>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

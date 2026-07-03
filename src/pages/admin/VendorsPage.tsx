import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAllVendors, updateProfile } from '@/services/api';
import { supabase } from '@/db/supabase';
import type { Profile } from '@/types/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Power, Eye, X, Save, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';

const VendorsPage: React.FC = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getAllVendors();
    setVendors(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddVendor = async () => {
    if (!newEmail.trim() || !newName.trim() || !newPassword.trim()) {
      toast.error('All fields are required');
      return;
    }
    setAdding(true);
    try {
      // Use the create-vendor Edge Function (service role) to bypass email confirmation
      // and ensure the trigger runs correctly with proper search_path
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-vendor', {
        body: {
          email: newEmail.trim().toLowerCase(),
          password: newPassword.trim(),
          full_name: newName.trim(),
        },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (res.error || res.data?.error) {
        const msg = res.data?.error ?? res.error?.message ?? 'Unknown error';
        toast.error('Failed to create vendor', { description: msg });
        return;
      }
      toast.success('Vendor created. They can now log in.');
      setAddOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setTimeout(() => load(), 1500);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (vendor: Profile) => {
    const newStatus = vendor.status === 'active' ? 'inactive' : 'active';
    const { error } = await updateProfile(vendor.id, { status: newStatus });
    if (error) { toast.error('Failed to update vendor'); return; }
    toast.success(`Vendor ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    load();
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Vendor Management</h1>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Vendor
          </Button>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              All Vendors ({vendors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-muted" />)}
              </div>
            ) : vendors.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No vendors yet. Add one to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Name', 'Email', 'Status', 'Created', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {vendors.map((v) => (
                      <tr key={v.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 font-medium text-foreground">{v.full_name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{v.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={v.status === 'active' ? 'default' : 'secondary'} className={v.status === 'active' ? 'bg-green-100 text-green-800' : ''}>
                            {v.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {format(new Date(v.created_at), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => navigate(`/admin/deliveries?vendor=${v.id}`)}
                            >
                              <Eye className="h-3 w-3" />
                              History
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 gap-1 text-xs ${v.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                              onClick={() => handleToggle(v)}
                            >
                              <Power className="h-3 w-3" />
                              {v.status === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Vendor Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vendor full name" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="vendor@company.com" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password <span className="text-destructive">*</span></Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" className="h-10" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button onClick={handleAddVendor} disabled={adding}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {adding ? 'Creating...' : 'Create Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default VendorsPage;

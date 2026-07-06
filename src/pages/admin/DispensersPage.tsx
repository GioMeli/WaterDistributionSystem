import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { format, parseISO, addDays } from 'date-fns';
import {
  Plus, Pencil, Trash2, Filter, Search, FlaskConical,
  AlertCircle, CheckCircle2, CalendarDays,
} from 'lucide-react';
import type { Dispenser, LocationRecord } from '@/types/types';

type FilterStatus = 'all' | 'active' | 'inactive';

const DispensersPage: React.FC = () => {
  const [dispensers, setDispensers] = useState<Dispenser[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterLocation, setFilterLocation] = useState('all');

  // Dialog
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Dispenser | null>(null);

  // Form
  const [form, setForm] = useState({
    location_id: '',
    serial_number: '',
    model: '',
    notes: '',
    is_active: true,
  });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Dispenser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: dData }, { data: lData }] = await Promise.all([
      supabase
        .from('dispensers')
        .select('*, location:locations(id,route_number,building_number,office_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('locations')
        .select('id,route_number,building_number,office_name,is_active')
        .eq('is_active', true)
        .order('office_name'),
    ]);
    setDispensers((dData as Dispenser[]) ?? []);
    setLocations((lData as LocationRecord[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = dispensers.filter((d) => {
    if (filterStatus === 'active' && !d.is_active) return false;
    if (filterStatus === 'inactive' && d.is_active) return false;
    if (filterLocation !== 'all' && d.location_id !== filterLocation) return false;
    if (search) {
      const q = search.toLowerCase();
      const loc = d.location as LocationRecord | null;
      const locName = loc?.office_name || '';
      if (
        !d.serial_number?.toLowerCase().includes(q) &&
        !d.model?.toLowerCase().includes(q) &&
        !locName.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ location_id: '', serial_number: '', model: '', notes: '', is_active: true });
    setOpen(true);
  };

  const openEdit = (d: Dispenser) => {
    setEditTarget(d);
    setForm({
      location_id: d.location_id || '',
      serial_number: d.serial_number || '',
      model: d.model || '',
      notes: d.notes || '',
      is_active: d.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      location_id: form.location_id || null,
      serial_number: form.serial_number.trim() || null,
      model: form.model.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    let error;
    if (editTarget) {
      ({ error } = await supabase.from('dispensers').update(payload).eq('id', editTarget.id));
    } else {
      ({ error } = await supabase.from('dispensers').insert(payload));
    }
    if (error) {
      toast.error('Save failed', { description: error.message });
    } else {
      toast.success(editTarget ? 'Dispenser updated' : 'Dispenser created');
      setOpen(false);
      load();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('dispensers').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Delete failed', { description: error.message });
    else { toast.success('Dispenser deleted'); load(); }
    setDeleteTarget(null);
  };

  const dueSoonCount = dispensers.filter((d) => {
    if (!d.next_due_date) return false;
    const due = parseISO(d.next_due_date);
    const in30 = addDays(new Date(), 30);
    return due <= in30 && due >= new Date();
  }).length;

  const overdueCount = dispensers.filter((d) => {
    if (!d.next_due_date) return false;
    return parseISO(d.next_due_date) < new Date();
  }).length;

  const locationName = (d: Dispenser) => {
    const loc = d.location as LocationRecord | null;
    return loc ? `${loc.office_name}` : '—';
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              Dispensers
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage water dispensers across all locations
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Add Dispenser
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: dispensers.length, icon: FlaskConical, color: 'text-primary' },
            { label: 'Active', value: dispensers.filter((d) => d.is_active).length, icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Due Soon', value: dueSoonCount, icon: CalendarDays, color: 'text-orange-500' },
            { label: 'Overdue', value: overdueCount, icon: AlertCircle, color: 'text-destructive' },
          ].map((s) => (
            <Card key={s.label} className="shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-48">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search serial #, model, office…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                <SelectTrigger className="h-9 w-36">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.office_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Dispensers <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FlaskConical className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium">No dispensers found</p>
                <p className="text-sm text-muted-foreground mt-1">Add a dispenser to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Serial #', 'Model', 'Location', 'Status', 'Next Due', 'Notes', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((d) => {
                      const dueDate = d.next_due_date ? parseISO(d.next_due_date) : null;
                      const isOverdue = dueDate && dueDate < new Date();
                      const isDueSoon = dueDate && dueDate >= new Date() && dueDate <= addDays(new Date(), 30);
                      return (
                        <tr key={d.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-medium text-foreground">
                            {d.serial_number || <span className="text-muted-foreground italic text-xs">No serial</span>}
                          </td>
                          <td className="px-4 py-3 text-foreground">{d.model || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{locationName(d)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={d.is_active ? 'default' : 'secondary'}>
                              {d.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {dueDate ? (
                              <span className={isOverdue ? 'text-destructive font-medium' : isDueSoon ? 'text-orange-500 font-medium' : 'text-foreground'}>
                                {format(dueDate, 'dd MMM yyyy')}
                                {isOverdue && ' ⚠'}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            {d.notes ? (
                              <span className="truncate block max-w-[180px] text-muted-foreground" title={d.notes}>{d.notes}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEdit(d)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget(d)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); else setOpen(true); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Dispenser' : 'Add Dispenser'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Location */}
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={form.location_id || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, location_id: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select location…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No location assigned</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.office_name} — {l.building_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Serial */}
            <div className="space-y-1.5">
              <Label htmlFor="serial">Serial Number</Label>
              <Input id="serial" placeholder="e.g. DS-2024-001" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} className="h-10" />
            </div>
            {/* Model */}
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="e.g. AquaPure 500" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className="h-10" />
            </div>
            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Any additional notes…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="px-3" />
            </div>
            {/* Active */}
            <div className="flex items-center gap-3">
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Dispenser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dispenser</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete dispenser <strong>{deleteTarget?.serial_number || deleteTarget?.id.slice(0, 8)}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default DispensersPage;

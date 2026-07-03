import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { getAllLocations, upsertLocation, toggleLocationActive } from '@/services/api';
import type { LocationRecord } from '@/types/types';
import { toast } from 'sonner';
import {
  Plus, Pencil, Power, Download, Upload, MapPin, X, Save
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const emptyLocation = (): Partial<LocationRecord> => ({
  route_number: '',
  building_number: '',
  office_name: '',
  sup_number: '',
  estimated_bottles: 0,
  latitude: null,
  longitude: null,
  location_notes: '',
  is_active: true,
  sort_order: 0,
});

const LocationsPage: React.FC = () => {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LocationRecord>>(emptyLocation());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getAllLocations();
    setLocations(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(emptyLocation());
    setDialogOpen(true);
  };

  const openEdit = (loc: LocationRecord) => {
    setEditing({ ...loc });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing.route_number?.trim() || !editing.office_name?.trim() || !editing.building_number?.trim()) {
      toast.error('Route Number, Building Number, and Office Name are required');
      return;
    }
    setSaving(true);
    const { error } = await upsertLocation(editing);
    setSaving(false);
    if (error) {
      toast.error('Failed to save location', { description: error.message });
      return;
    }
    toast.success(editing.id ? 'Location updated' : 'Location added');
    setDialogOpen(false);
    load();
  };

  const handleToggle = async (loc: LocationRecord) => {
    const { error } = await toggleLocationActive(loc.id, !loc.is_active);
    if (error) { toast.error('Failed to update location'); return; }
    toast.success(`Location ${loc.is_active ? 'deactivated' : 'activated'}`);
    load();
  };

  const exportCSV = () => {
    const rows = [
      ['route_number', 'building_number', 'office_name', 'sup_number', 'estimated_bottles', 'latitude', 'longitude', 'location_notes', 'is_active'],
      ...locations.map((l) => [l.route_number, l.building_number, l.office_name, l.sup_number, l.estimated_bottles, l.latitude ?? '', l.longitude ?? '', l.location_notes ?? '', l.is_active]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'locations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const header = lines[0].split(',');
      const dataLines = lines.slice(1);
      let imported = 0;
      for (const line of dataLines) {
        const cols = line.split(',');
        const loc: Partial<LocationRecord> = {
          route_number: cols[0]?.trim() || '',
          building_number: cols[1]?.trim() || '',
          office_name: cols[2]?.trim() || '',
          sup_number: cols[3]?.trim() || '',
          estimated_bottles: Number(cols[4]) || 0,
          latitude: cols[5] ? Number(cols[5]) : null,
          longitude: cols[6] ? Number(cols[6]) : null,
          location_notes: cols[7]?.trim() || null,
          is_active: cols[8]?.trim() !== 'false',
          sort_order: imported,
        };
        if (loc.route_number && loc.office_name) {
          await upsertLocation(loc);
          imported++;
        }
      }
      toast.success(`Imported ${imported} locations`);
      load();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">Location Management</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Label htmlFor="csvImport" className="cursor-pointer">
              <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" asChild>
                <span>
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                </span>
              </Button>
              <input id="csvImport" type="file" accept=".csv" className="hidden" onChange={importCSV} />
            </Label>
            <Button size="sm" className="gap-1.5" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add Location
            </Button>
          </div>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Route', 'Building', 'Office Name', 'SUP No.', 'Est. Bottles', 'Coordinates', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {locations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-muted/10">
                        <td className="px-3 py-2.5 font-medium text-foreground">{loc.route_number}</td>
                        <td className="px-3 py-2.5 text-foreground">{loc.building_number}</td>
                        <td className="max-w-xs px-3 py-2.5 text-foreground">{loc.office_name}</td>
                        <td className="px-3 py-2.5 text-foreground">{loc.sup_number}</td>
                        <td className="px-3 py-2.5 text-foreground">{loc.estimated_bottles}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {loc.latitude && loc.longitude
                            ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={loc.is_active ? 'default' : 'secondary'} className={loc.is_active ? 'bg-green-100 text-green-800' : ''}>
                            {loc.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEdit(loc)}>
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 gap-1 text-xs ${loc.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                              onClick={() => handleToggle(loc)}
                            >
                              <Power className="h-3 w-3" />
                              {loc.is_active ? 'Deactivate' : 'Activate'}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {editing.id ? 'Edit Location' : 'Add Location'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { key: 'route_number', label: 'Route Number', required: true },
              { key: 'building_number', label: 'Building Number', required: true },
              { key: 'office_name', label: 'Office Name', required: true, full: true },
              { key: 'sup_number', label: 'SUP Number', required: false },
              { key: 'estimated_bottles', label: 'Estimated Bottles', type: 'number' },
              { key: 'latitude', label: 'Latitude', type: 'number' },
              { key: 'longitude', label: 'Longitude', type: 'number' },
              { key: 'sort_order', label: 'Sort Order', type: 'number' },
            ].map((f) => (
              <div key={f.key} className={`space-y-1 ${f.full ? 'sm:col-span-2' : ''}`}>
                <Label htmlFor={f.key}>
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id={f.key}
                  type={f.type || 'text'}
                  value={(editing as Record<string, unknown>)[f.key] as string ?? ''}
                  onChange={(e) =>
                    setEditing((prev) => ({
                      ...prev,
                      [f.key]: f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value,
                    }))
                  }
                  className="h-9"
                />
              </div>
            ))}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="location_notes">Notes</Label>
              <Textarea
                id="location_notes"
                value={editing.location_notes || ''}
                onChange={(e) => setEditing((p) => ({ ...p, location_notes: e.target.value }))}
                rows={2}
                className="px-3"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="is_active"
                checked={editing.is_active ?? true}
                onCheckedChange={(c) => setEditing((p) => ({ ...p, is_active: c as boolean }))}
              />
              <Label htmlFor="is_active" className="cursor-pointer">Active (appears in new deliveries)</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default LocationsPage;

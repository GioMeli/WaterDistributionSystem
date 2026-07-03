import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import {
  Upload, Download, Search, FileText, Trash2, Eye, X, CalendarDays, Filter,
} from 'lucide-react';

interface OrderRecord {
  id: string;
  name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
  uploader_name: string | null;
  notes: string | null;
}

const fmt = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const OrderHistoryPage: React.FC = () => {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');

  // Search & filter
  const [searchText, setSearchText] = useState('');
  const [filterMode, setFilterMode] = useState<'none' | 'month' | 'exact' | 'range'>('none');
  const [filterMonth, setFilterMonth] = useState('');   // YYYY-MM
  const [filterDate, setFilterDate] = useState('');    // YYYY-MM-DD
  const [filterStart, setFilterStart] = useState('');  // YYYY-MM-DD
  const [filterEnd, setFilterEnd] = useState('');      // YYYY-MM-DD

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('order_history')
      .select('id, name, file_url, file_size, uploaded_at, uploader_name, notes')
      .order('uploaded_at', { ascending: false });
    if (error) toast.error('Failed to load orders');
    setOrders((data as OrderRecord[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (searchText && !o.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    const d = o.uploaded_at.slice(0, 10); // YYYY-MM-DD
    if (filterMode === 'month' && filterMonth) {
      const start = format(startOfMonth(parseISO(`${filterMonth}-01`)), 'yyyy-MM-dd');
      const end   = format(endOfMonth(parseISO(`${filterMonth}-01`)), 'yyyy-MM-dd');
      if (d < start || d > end) return false;
    }
    if (filterMode === 'exact' && filterDate && d !== filterDate) return false;
    if (filterMode === 'range') {
      if (filterStart && d < filterStart) return false;
      if (filterEnd   && d > filterEnd)   return false;
    }
    return true;
  });

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { toast.error('Only PDF files are allowed'); return; }
    if (f.size > 52_428_800) { toast.error('File exceeds 50 MB limit'); return; }
    setUploadFile(f);
    if (!uploadName) setUploadName(f.name.replace(/\.pdf$/i, ''));
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || !profile) return;
    setUploading(true);
    try {
      const path = `orders/${Date.now()}_${uploadFile.name.replace(/\s+/g, '_')}`;
      const { error: storageErr } = await supabase.storage
        .from('order-pdfs')
        .upload(path, uploadFile, { contentType: 'application/pdf', upsert: false });
      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage.from('order-pdfs').getPublicUrl(path);
      // Use signed URL approach since bucket is private
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('order-pdfs')
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10-year signed URL
      if (signedErr) throw signedErr;

      const { error: dbErr } = await supabase.from('order_history').insert({
        name: uploadName.trim(),
        file_url: path, // store path; generate signed URL on download
        file_size: uploadFile.size,
        uploader_id: profile.id,
        uploader_name: profile.full_name || profile.email,
        notes: uploadNotes.trim() || null,
      });
      if (dbErr) throw dbErr;

      toast.success('Work order saved to history');
      setUploadOpen(false);
      setUploadFile(null);
      setUploadName('');
      setUploadNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err: unknown) {
      toast.error('Upload failed', { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  // ── Download / View ────────────────────────────────────────────────────────
  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('order-pdfs')
      .createSignedUrl(path, 300); // 5-min URL for download/view
    if (error) { toast.error('Could not generate download link'); return null; }
    return data.signedUrl;
  };

  const handleView = async (o: OrderRecord) => {
    const url = await getSignedUrl(o.file_url);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleDownload = async (o: OrderRecord) => {
    const url = await getSignedUrl(o.file_url);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${o.name}.pdf`;
    a.click();
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error: storageErr } = await supabase.storage
      .from('order-pdfs')
      .remove([deleteTarget.file_url]);
    if (storageErr) { toast.error('Failed to remove file'); setDeleteTarget(null); return; }
    const { error: dbErr } = await supabase.from('order_history').delete().eq('id', deleteTarget.id);
    if (dbErr) { toast.error('Failed to remove record'); setDeleteTarget(null); return; }
    toast.success('Order deleted');
    setDeleteTarget(null);
    load();
  };

  const clearFilters = () => {
    setSearchText(''); setFilterMode('none');
    setFilterMonth(''); setFilterDate(''); setFilterStart(''); setFilterEnd('');
  };

  const hasActiveFilter = searchText || filterMode !== 'none';

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Orders History</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Store and retrieve work order PDFs with date-based search
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload Work Order
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <Filter className="h-4 w-4" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name search */}
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-9 pl-9"
              />
            </div>

            {/* Filter mode buttons */}
            <div className="flex flex-wrap gap-2">
              {(['none', 'month', 'exact', 'range'] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={filterMode === mode ? 'default' : 'outline'}
                  onClick={() => setFilterMode(mode)}
                  className="capitalize gap-1.5"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {mode === 'none' ? 'All Dates' : mode === 'exact' ? 'Exact Date' : mode === 'month' ? 'By Month' : 'Date Range'}
                </Button>
              ))}
              {hasActiveFilter && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>

            {/* Date inputs */}
            {filterMode === 'month' && (
              <div className="space-y-1 max-w-xs">
                <Label className="text-xs">Month</Label>
                <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="h-9" />
              </div>
            )}
            {filterMode === 'exact' && (
              <div className="space-y-1 max-w-xs">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-9" />
              </div>
            )}
            {filterMode === 'range' && (
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="h-9" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Work Orders
              <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-muted" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No orders found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasActiveFilter ? 'Try adjusting your filters.' : 'Upload a work order PDF to get started.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Name', 'Date Saved', 'Uploaded By', 'Size', 'Notes', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-primary" />
                            <span className="max-w-xs truncate font-medium text-foreground">{o.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {format(parseISO(o.uploaded_at), 'dd MMM yyyy, HH:mm')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{o.uploader_name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmt(o.file_size)}</td>
                        <td className="max-w-xs px-4 py-3 text-muted-foreground">
                          {o.notes ? (
                            <span className="truncate block max-w-[160px]" title={o.notes}>{o.notes}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleView(o)}
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleDownload(o)}
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(o)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => {
        if (!open) { setUploadFile(null); setUploadName(''); setUploadNotes(''); if (fileInputRef.current) fileInputRef.current.value = ''; }
        setUploadOpen(open);
      }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Save Work Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {uploadFile && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-foreground">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(uploadFile.size)}</p>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="orderName">Order Name <span className="text-destructive">*</span></Label>
              <Input
                id="orderName"
                placeholder="e.g. Work Order #42 – UN Building B"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orderNotes">Notes (optional)</Label>
              <Textarea
                id="orderNotes"
                placeholder="Any additional context…"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                rows={3}
                className="px-3"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadName.trim()}>
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Saving…
                </span>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Save to History
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Work Order</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>?
            This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default OrderHistoryPage;

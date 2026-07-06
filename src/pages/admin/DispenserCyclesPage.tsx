import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { NativeSigCanvas, type NativeSigCanvasHandle } from '@/components/common/SignaturePad';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile } from '@/services/api';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  Eye, Download, FileCheck2, XCircle, Search, Filter,
  Droplets, FlaskConical, RotateCcw, CheckCircle2, Paperclip,
  Clock,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { DispenserCycle, DispenserCycleItem } from '@/types/types';
import { generateCycleSummaryPdf, generateIndividualDispenserPdf } from '@/utils/generateDispenserPdf';

const statusColor: Record<string, string> = {
  open:               'bg-muted text-muted-foreground',
  submitted_to_admin: 'bg-orange-100 text-orange-700',
  approved:           'bg-green-100 text-green-700',
  rejected:           'bg-red-100 text-red-700',
  returned:           'bg-purple-100 text-purple-700',
  completed:          'bg-green-100 text-green-700',
  in_process:         'bg-yellow-100 text-yellow-700',
  pending:            'bg-muted text-muted-foreground',
};

const fmtDate = (d: string | null | undefined) =>
  d ? format(parseISO(d), 'dd MMM yyyy') : '—';

const DispenserCyclesPage: React.FC = () => {
  const { profile } = useAuth();

  // ── Items pending review (across all cycles) ──────────────────────────────
  const [pendingItems, setPendingItems] = useState<(DispenserCycleItem & { cycle?: DispenserCycle })[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // ── All cycles view ────────────────────────────────────────────────────────
  const [cycles, setCycles] = useState<DispenserCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProcess, setFilterProcess] = useState('all');

  // Cycle detail dialog
  const [selectedCycle, setSelectedCycle] = useState<DispenserCycle | null>(null);
  const [cycleItems, setCycleItems] = useState<DispenserCycleItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Per-item review dialog
  const [reviewItem, setReviewItem] = useState<DispenserCycleItem | null>(null);
  const [reviewItemCycle, setReviewItemCycle] = useState<DispenserCycle | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const adminSigRef = useRef<NativeSigCanvasHandle>(null);
  const [adminSigDataUrl, setAdminSigDataUrl] = useState<string | null>(null);
  const [adminSigSaved, setAdminSigSaved] = useState(false);

  // PDF
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    const { data: items } = await supabase
      .from('dispenser_cycle_items')
      .select('*, cycle:dispenser_cycles(*)')
      .eq('status', 'submitted_to_admin')
      .order('created_at', { ascending: true });
    setPendingItems((items as (DispenserCycleItem & { cycle?: DispenserCycle })[]) ?? []);
    setLoadingPending(false);
  }, []);

  const loadCycles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dispenser_cycles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error('Failed to load cycles');
    setCycles((data as DispenserCycle[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPending(); loadCycles(); }, [loadPending, loadCycles]);

  const loadCycleItems = async (cycleId: string) => {
    setLoadingItems(true);
    const { data } = await supabase
      .from('dispenser_cycle_items')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('created_at');
    setCycleItems((data as DispenserCycleItem[]) ?? []);
    setLoadingItems(false);
  };

  const openCycleDetail = async (cycle: DispenserCycle) => {
    setSelectedCycle(cycle);
    await loadCycleItems(cycle.id);
  };

  // ── Per-item review ────────────────────────────────────────────────────────
  const openReviewItem = (item: DispenserCycleItem, cycle: DispenserCycle | null, action: 'approve' | 'reject') => {
    setReviewItem(item);
    setReviewItemCycle(cycle);
    setReviewAction(action);
    setReviewComment('');
    setAdminSigDataUrl(null);
    setAdminSigSaved(false);
  };

  const handleSaveAdminSig = () => {
    if (adminSigRef.current?.isEmpty()) { toast.error('Please draw your signature'); return; }
    setAdminSigDataUrl(adminSigRef.current!.getTrimmedCanvas().toDataURL('image/png'));
    setAdminSigSaved(true);
  };

  const handleReviewItem = async () => {
    if (!reviewItem || !profile) return;
    if (reviewAction === 'approve' && !adminSigDataUrl) { toast.error('Admin signature required for approval'); return; }
    if (reviewAction === 'reject' && !reviewComment.trim()) { toast.error('Rejection reason required'); return; }

    setReviewSaving(true);
    try {
      let adminSigUrl: string | null = null;
      if (reviewAction === 'approve' && adminSigDataUrl) {
        const blob = await fetch(adminSigDataUrl).then((r) => r.blob());
        const sigPath = `signatures/${reviewItem.cycle_id}/${reviewItem.id}_admin.png`;
        adminSigUrl = await uploadFile('dispenser-assets', sigPath, blob, 'image/png');
        if (!adminSigUrl) throw new Error('Admin signature upload failed');
      }

      const newStatus = reviewAction === 'approve' ? 'approved' : 'rejected';
      const updates: Partial<DispenserCycleItem> = {
        status: newStatus,
        admin_id: profile.id,
        admin_full_name: profile.full_name || profile.email,
        admin_comments: reviewComment.trim() || null,
        admin_approved_at: reviewAction === 'approve' ? new Date().toISOString() : null,
        admin_signature_url: adminSigUrl,
      };

      const { error } = await supabase
        .from('dispenser_cycle_items')
        .update(updates)
        .eq('id', reviewItem.id);
      if (error) throw error;

      // If approved, update the dispenser's next_due_date
      if (reviewAction === 'approve' && reviewItem.next_due_date) {
        await supabase
          .from('dispensers')
          .update({
            next_due_date: reviewItem.next_due_date,
            last_completed_at: new Date().toISOString(),
          })
          .eq('id', reviewItem.dispenser_id);
      }

      toast.success(`Item ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully`);
      setReviewItem(null);
      setReviewItemCycle(null);
      loadPending();
      loadCycles();
      if (selectedCycle) loadCycleItems(selectedCycle.id);
    } catch (err: unknown) {
      toast.error('Failed to update item', { description: (err as Error).message });
    } finally {
      setReviewSaving(false);
    }
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handleItemPdf = async (item: DispenserCycleItem, cycle: DispenserCycle) => {
    setGeneratingPdf(item.id);
    try {
      const blob = await generateIndividualDispenserPdf(item, cycle.process_type, cycle.vendor_full_name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dispenser-${item.serial_number || item.id.slice(0, 8)}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('PDF generation failed'); }
    finally { setGeneratingPdf(null); }
  };

  const handleCyclePdf = async (cycle: DispenserCycle) => {
    setGeneratingPdf(`cycle-${cycle.id}`);
    try {
      const { data: items } = await supabase
        .from('dispenser_cycle_items')
        .select('*')
        .eq('cycle_id', cycle.id)
        .order('created_at');
      const blob = await generateCycleSummaryPdf(cycle, (items as DispenserCycleItem[]) ?? []);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `cycle-${cycle.process_type}-${cycle.id.slice(0, 8)}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('PDF generation failed'); }
    finally { setGeneratingPdf(null); }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!cycleItems.length || !selectedCycle) return;
    const rows = cycleItems.map((item) => ({
      'Serial #': item.serial_number || '',
      'Model': item.model || '',
      'Location': item.location_name || '',
      'Collected': item.collected_date || '',
      'Collect Officer': item.collect_officer_name || '',
      'Returned': item.returned_date || '',
      'Return Officer': item.return_officer_name || '',
      'Status': item.status,
      'Next Due': item.next_due_date || '',
      'Admin': item.admin_full_name || '',
      'Has Attachment': item.result_attachment_url ? 'Yes' : 'No',
      'Notes': item.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    XLSX.writeFile(wb, `cycle-${selectedCycle.process_type}-${selectedCycle.id.slice(0, 8)}.xlsx`);
    toast.success('Excel exported');
  };

  const filteredCycles = cycles.filter((c) => {
    if (filterProcess !== 'all' && c.process_type !== filterProcess) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.vendor_full_name.toLowerCase().includes(q) && !c.id.includes(q)) return false;
    }
    return true;
  });

  const processIcon = (type: string) =>
    type === 'sanitisation'
      ? <Droplets className="h-3.5 w-3.5" />
      : <FlaskConical className="h-3.5 w-3.5" />;

  // ── Pending item card ─────────────────────────────────────────────────────
  const renderPendingCard = (item: DispenserCycleItem & { cycle?: DispenserCycle }) => {
    const cycle = item.cycle ?? null;
    const isGen = generatingPdf === item.id;
    return (
      <div key={item.id} className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 space-y-2">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">
              {item.serial_number || 'S/N —'} · {item.model || '—'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{item.location_name || 'No location'}</p>
            {cycle && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                {processIcon(cycle.process_type)}
                <span className="capitalize">{cycle.process_type}</span>
                &nbsp;·&nbsp;{cycle.vendor_full_name}
              </p>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            <Clock className="h-3 w-3" /> Pending Review
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>Collected: <span className="text-foreground">{fmtDate(item.collected_date)}</span></span>
          <span>Officer: <span className="text-foreground">{item.collect_officer_name || '—'}</span></span>
          <span>Returned: <span className="text-foreground">{fmtDate(item.returned_date)}</span></span>
          <span>Return Off.: <span className="text-foreground">{item.return_officer_name || '—'}</span></span>
          {item.next_due_date && (
            <span className="col-span-2">Next due: <span className="font-medium text-foreground">{fmtDate(item.next_due_date)}</span></span>
          )}
        </div>

        {item.result_attachment_url && (
          <a href={item.result_attachment_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-700 underline">
            <Paperclip className="h-3.5 w-3.5" /> View descaling result attachment
          </a>
        )}

        {/* Signature preview */}
        {item.vendor_signature_url && (
          <div className="rounded border border-border bg-white p-1.5">
            <p className="text-xs text-muted-foreground mb-1">Vendor Signature</p>
            <img src={item.vendor_signature_url} alt="Vendor sig" className="h-12 object-contain" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {cycle && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => handleItemPdf(item, cycle)} disabled={isGen}>
              <Download className="h-3 w-3" />{isGen ? '…' : 'PDF'}
            </Button>
          )}
          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
            onClick={() => openReviewItem(item, cycle, 'reject')}>
            <XCircle className="h-3 w-3" /> Reject
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
            onClick={() => openReviewItem(item, cycle, 'approve')}>
            <FileCheck2 className="h-3 w-3" /> Approve &amp; Sign
          </Button>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" />
            Dispenser Cycles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and approve individual dispenser items submitted by vendors
          </p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Review
              {pendingItems.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-xs">{pendingItems.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Cycles</TabsTrigger>
          </TabsList>

          {/* ── Pending Review tab ─────────────────────────────────────────── */}
          <TabsContent value="pending" className="mt-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Items Awaiting Your Approval
                  <Badge variant="secondary">{pendingItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {loadingPending ? (
                  <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-24 animate-pulse rounded bg-muted"/>)}</div>
                ) : pendingItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-400 mb-3" />
                    <p className="font-medium text-foreground">All caught up!</p>
                    <p className="text-sm text-muted-foreground mt-1">No dispenser items are waiting for your approval.</p>
                  </div>
                ) : (
                  <div className="space-y-3">{pendingItems.map(renderPendingCard)}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── All Cycles tab ─────────────────────────────────────────────── */}
          <TabsContent value="all" className="mt-4 space-y-4">
            {/* Filters */}
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="relative flex-1 min-w-48">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search vendor or ID…" value={search}
                      onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
                  </div>
                  <Select value={filterProcess} onValueChange={setFilterProcess}>
                    <SelectTrigger className="h-9 w-44">
                      <Filter className="h-3.5 w-3.5 mr-1" />
                      <SelectValue placeholder="Process" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Processes</SelectItem>
                      <SelectItem value="sanitisation">Sanitisation</SelectItem>
                      <SelectItem value="descaling">Descaling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Cycles <Badge variant="secondary" className="ml-1">{filteredCycles.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-2 p-4">{[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>
                ) : filteredCycles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <RotateCcw className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No cycles found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {['ID', 'Process', 'Vendor', 'Created', 'Actions'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredCycles.map((c) => (
                          <tr key={c.id} className="hover:bg-muted/10">
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.id.slice(0, 8).toUpperCase()}</td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1.5 capitalize font-medium text-foreground">
                                {processIcon(c.process_type)}{c.process_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-foreground">{c.vendor_full_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
                            <td className="px-4 py-3 flex items-center gap-2">
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openCycleDetail(c)}>
                                <Eye className="h-3.5 w-3.5" /> View Items
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                                onClick={() => handleCyclePdf(c)}
                                disabled={generatingPdf === `cycle-${c.id}`}>
                                <Download className="h-3.5 w-3.5" />
                                {generatingPdf === `cycle-${c.id}` ? '…' : 'PDF'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Cycle detail dialog ── */}
      <Dialog open={!!selectedCycle} onOpenChange={(o) => { if (!o) { setSelectedCycle(null); setCycleItems([]); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Cycle Items — {selectedCycle && <span className="capitalize">{selectedCycle.process_type}</span>}
              <span className="text-muted-foreground font-normal text-sm ml-1">({selectedCycle?.vendor_full_name})</span>
            </DialogTitle>
          </DialogHeader>

          {loadingItems ? (
            <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted"/>)}</div>
          ) : (
            <div className="space-y-3">
              {cycleItems.map((item) => {
                const isGen = generatingPdf === item.id;
                return (
                  <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{item.serial_number || 'S/N —'} · {item.model || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.location_name || 'No location'}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[item.status] || ''}`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Collected: <span className="text-foreground">{fmtDate(item.collected_date)}</span></span>
                      <span>Returned: <span className="text-foreground">{fmtDate(item.returned_date)}</span></span>
                      {item.next_due_date && <span className="col-span-2">Next due: <span className="font-medium text-foreground">{fmtDate(item.next_due_date)}</span></span>}
                      {item.admin_full_name && <span className="col-span-2">Admin: <span className="text-foreground">{item.admin_full_name} · {fmtDate(item.admin_approved_at)}</span></span>}
                    </div>
                    {item.result_attachment_url && (
                      <a href={item.result_attachment_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-700 underline">
                        <Paperclip className="h-3 w-3" /> Descaling result attachment
                      </a>
                    )}
                    {item.admin_comments && (
                      <p className="text-xs text-red-700 bg-red-50 rounded p-1.5 border border-red-200">
                        Admin note: {item.admin_comments}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {selectedCycle && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => handleItemPdf(item, selectedCycle)} disabled={isGen}>
                          <Download className="h-3 w-3" />{isGen ? '…' : 'PDF'}
                        </Button>
                      )}
                      {item.status === 'submitted_to_admin' && selectedCycle && (
                        <>
                          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
                            onClick={() => openReviewItem(item, selectedCycle, 'reject')}>
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                          <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                            onClick={() => openReviewItem(item, selectedCycle, 'approve')}>
                            <FileCheck2 className="h-3 w-3" /> Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setSelectedCycle(null); setCycleItems([]); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Per-item review dialog ── */}
      <Dialog open={!!reviewItem} onOpenChange={(o) => { if (!o) { setReviewItem(null); setReviewItemCycle(null); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Dispenser — {reviewItem?.serial_number || '—'}
            </DialogTitle>
          </DialogHeader>

          {reviewItem && (
            <div className="space-y-4 py-1">
              {/* Item summary */}
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Serial:</span> {reviewItem.serial_number || '—'}</p>
                <p><span className="text-muted-foreground">Location:</span> {reviewItem.location_name || '—'}</p>
                <p><span className="text-muted-foreground">Returned:</span> {fmtDate(reviewItem.returned_date)} · Next due: <strong>{fmtDate(reviewItem.next_due_date)}</strong></p>
              </div>

              {/* Attachment preview for descaling */}
              {reviewItem.result_attachment_url && (
                <div className="space-y-1.5">
                  <Label>Descaling Result Attachment</Label>
                  <a href={reviewItem.result_attachment_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-700 hover:bg-blue-100 transition-colors">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="truncate">View attachment</span>
                    <Eye className="h-4 w-4 shrink-0 ml-auto" />
                  </a>
                </div>
              )}

              {/* Vendor signature */}
              {reviewItem.vendor_signature_url && (
                <div className="space-y-1.5">
                  <Label>Vendor Signature</Label>
                  <div className="rounded border border-border bg-white p-2">
                    <img src={reviewItem.vendor_signature_url} alt="Vendor signature" className="h-16 max-w-full object-contain" />
                  </div>
                </div>
              )}

              {/* Comment */}
              <div className="space-y-1.5">
                <Label htmlFor="review-comment">
                  Comment {reviewAction === 'reject' ? <span className="text-destructive">*</span> : '(optional)'}
                </Label>
                <Textarea
                  id="review-comment"
                  placeholder={reviewAction === 'reject' ? 'Reason for rejection…' : 'Optional approval notes…'}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3} className="px-3"
                />
              </div>

              {/* Admin signature for approval */}
              {reviewAction === 'approve' && (
                <div className="space-y-2">
                  <Label>Admin Signature <span className="text-destructive">*</span></Label>
                  {adminSigSaved && adminSigDataUrl ? (
                    <div className="space-y-2">
                      <div className="rounded border border-border bg-white p-2">
                        <img src={adminSigDataUrl} alt="Admin signature" className="h-20 max-w-full object-contain" />
                      </div>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => { setAdminSigDataUrl(null); setAdminSigSaved(false); adminSigRef.current?.clear(); }}>
                        Redo Signature
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded border-2 border-border bg-white">
                        <NativeSigCanvas ref={adminSigRef} penColor="#1E293B"
                          canvasProps={{ width: 400, height: 140, className: 'w-full rounded' }} />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => adminSigRef.current?.clear()}>Clear</Button>
                        <Button type="button" size="sm" onClick={handleSaveAdminSig}>Save Signature</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReviewItem(null); setReviewItemCycle(null); }} disabled={reviewSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleReviewItem}
              disabled={
                reviewSaving ||
                (reviewAction === 'reject' && !reviewComment.trim()) ||
                (reviewAction === 'approve' && !adminSigSaved)
              }
              className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={reviewAction === 'reject' ? 'destructive' : 'default'}
            >
              {reviewSaving ? 'Saving…' : reviewAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default DispenserCyclesPage;

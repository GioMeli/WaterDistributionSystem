/**
 * Shared vendor dispenser workflow page.
 * Used by both SanitisationPage and DescalingPage via the `processType` prop.
 *
 * Per-item workflow:
 *   pending → in_process (collect: date + officer + sig)
 *           → returned   (return:  date + officer + sig; descaling also needs result attachment)
 *           → completed  (vendor signs off on individual item)
 *           → submitted_to_admin (vendor submits this single item to admin)
 *           → approved / rejected (admin decision per item)
 *
 * Lock period: sanitisation = 6 months, descaling = 12 months
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { NativeSigCanvas, type NativeSigCanvasHandle } from '@/components/common/SignaturePad';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, addMonths, addYears, isAfter } from 'date-fns';
import {
  FlaskConical, Droplets, CheckCircle2, Clock, ArrowRight,
  Send, Download, RefreshCw, Lock, Paperclip, Eye,
  XCircle, AlertCircle,
} from 'lucide-react';
import { uploadFile } from '@/services/api';
import { generateIndividualDispenserPdf } from '@/utils/generateDispenserPdf';
import type { DispenserProcessType, DispenserCycle, DispenserCycleItem, Dispenser } from '@/types/types';
import { useNavigate, useParams } from 'react-router-dom';

// ── helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null | undefined) =>
  d ? format(new Date(d), 'dd MMM yyyy') : '—';

/** Lock period: sanitisation = 6 months, descaling = 12 months */
const calcNextDue = (returnedDate: string, pt: DispenserProcessType): string =>
  pt === 'descaling'
    ? format(addYears(new Date(returnedDate), 1), 'yyyy-MM-dd')
    : format(addMonths(new Date(returnedDate), 6), 'yyyy-MM-dd');

const STATUS_COLOR: Record<string, string> = {
  pending:            'bg-muted text-muted-foreground',
  in_process:         'bg-yellow-100 text-yellow-700',
  returned:           'bg-purple-100 text-purple-700',
  completed:          'bg-green-100 text-green-700',
  submitted_to_admin: 'bg-orange-100 text-orange-700',
  approved:           'bg-green-200 text-green-800',
  rejected:           'bg-red-100 text-red-700',
};

interface Props {
  processType: DispenserProcessType;
}

type StepMode = 'collect' | 'return' | 'vendor_sign';

const VendorDispenserWorkflowPage: React.FC<Props> = ({ processType }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { cycleId } = useParams<{ cycleId: string }>();

  // ── State ──
  const [cycle, setCycle] = useState<DispenserCycle | null>(null);
  const [cycleItems, setCycleItems] = useState<DispenserCycleItem[]>([]);
  const [dispensers, setDispensers] = useState<Dispenser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  // Step dialog
  const [stepItem, setStepItem] = useState<DispenserCycleItem | null>(null);
  const [stepMode, setStepMode] = useState<StepMode>('collect');
  const [stepDate, setStepDate] = useState('');
  const [stepOfficer, setStepOfficer] = useState('');
  const [stepNotes, setStepNotes] = useState('');
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const sigRef = useRef<NativeSigCanvasHandle>(null);
  const [sigSaved, setSigSaved] = useState(false);
  // descaling attachment
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  // Submit-to-admin (per item)
  const [submitting, setSubmitting] = useState<string | null>(null); // item id

  // Detail view dialog (read-only)
  const [detailItem, setDetailItem] = useState<DispenserCycleItem | null>(null);

  // PDF state
  const [pdfItem, setPdfItem] = useState<string | null>(null);

  // ── Load / init ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!profile || !cycleId) return;

    setLoading(true);

    const { data: cycleData, error: cycleError } = await supabase
      .from('dispenser_cycles')
      .select('*')
      .eq('id', cycleId)
      .eq('vendor_id', profile.id)
      .eq('process_type', processType)
      .maybeSingle();

    if (cycleError || !cycleData) {
      toast.error('Process not found');
      navigate(`/vendor/${processType}`);
      setLoading(false);
      return;
    }

    setCycle(cycleData as DispenserCycle);

    const { data: itemData, error: itemError } = await supabase
      .from('dispenser_cycle_items')
      .select('*')
      .eq('cycle_id', cycleData.id)
      .order('created_at');

    if (itemError) {
      toast.error('Failed to load process items');
      setLoading(false);
      return;
    }

    setCycleItems((itemData as DispenserCycleItem[]) ?? []);
    setLoading(false);
  }, [profile, processType, cycleId, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Tab buckets ────────────────────────────────────────────────────────────
  const today = new Date();
  const pendingItems    = cycleItems.filter((i) => i.status === 'pending' || (i.status === 'rejected'));
  const inProgressItems = cycleItems.filter((i) => ['in_process', 'returned'].includes(i.status));
  const completedItems  = cycleItems.filter((i) => ['completed', 'submitted_to_admin'].includes(i.status));
  const lockedItems     = cycleItems.filter((i) =>
    i.status === 'approved' && !!i.next_due_date && isAfter(new Date(i.next_due_date), today));

  // ── Open step dialog ───────────────────────────────────────────────────────
  const openStep = (item: DispenserCycleItem, mode: StepMode) => {
    setStepItem(item);
    setStepMode(mode);
    setStepDate(format(new Date(), 'yyyy-MM-dd'));
    setStepOfficer('');
    setStepNotes('');
    setSigDataUrl(null);
    setSigSaved(false);
    setAttachFile(null);
  };

  const handleSaveSig = () => {
    if (sigRef.current?.isEmpty()) { toast.error('Please draw a signature first'); return; }
    setSigDataUrl(sigRef.current!.getTrimmedCanvas().toDataURL('image/png'));
    setSigSaved(true);
  };

  // ── Save step ──────────────────────────────────────────────────────────────
  const handleSaveStep = async () => {
    if (!stepItem || !profile) return;
    if (!sigDataUrl) { toast.error('Signature is required'); return; }
    if (stepMode !== 'vendor_sign' && !stepDate) { toast.error('Date is required'); return; }
    if (stepMode !== 'vendor_sign' && !stepOfficer.trim()) { toast.error('Officer name is required'); return; }
    if (stepMode === 'return' && processType === 'descaling' && !attachFile) {
      toast.error('Descaling results attachment is required'); return;
    }

    setSaving(true);
    try {
      // upload signature
      const sigBlob = await fetch(sigDataUrl).then((r) => r.blob());
      const sigPath = `signatures/${stepItem.cycle_id}/${stepItem.id}_${stepMode}.png`;
      const sigUrl = await uploadFile('dispenser-assets', sigPath, sigBlob, 'image/png');
      if (!sigUrl) throw new Error('Signature upload failed');

      let updates: Partial<DispenserCycleItem> = {};

      if (stepMode === 'collect') {
        updates = {
          collected_date: stepDate,
          collect_officer_name: stepOfficer.trim(),
          collect_officer_signature_url: sigUrl,
          status: 'in_process',
          notes: stepNotes.trim() || stepItem.notes,
        };
      } else if (stepMode === 'return') {
        const nextDue = calcNextDue(stepDate, processType);
        let attachUrl: string | null = null;

        if (processType === 'descaling' && attachFile) {
          setAttachUploading(true);
          const ext = attachFile.name.split('.').pop() || 'pdf';
          const attPath = `attachments/${stepItem.cycle_id}/${stepItem.id}_return_result.${ext}`;
          attachUrl = await uploadFile('dispenser-assets', attPath, attachFile, attachFile.type);
          setAttachUploading(false);

          if (!attachUrl) throw new Error('Attachment upload failed');
        }
        updates = {
          returned_date: stepDate,
          return_officer_name: stepOfficer.trim(),
          return_officer_signature_url: sigUrl,
          status: 'returned',
          next_due_date: nextDue,
          notes: stepNotes.trim() || stepItem.notes,
          ...(attachUrl ? { result_attachment_url: attachUrl } : {}),
        };
      } else {
        // vendor_sign → completed only. Attachment is uploaded during return for descaling.
        updates = {
          vendor_signature_url: sigUrl,
          status: 'completed',
        };
      }

      const { error } = await supabase
        .from('dispenser_cycle_items')
        .update(updates)
        .eq('id', stepItem.id);
      if (error) throw error;

      if (stepMode === 'return') {
        const dispenserUpdate =
          processType === 'descaling'
            ? {
                descaling_next_due_date: calcNextDue(stepDate, processType),
                descaling_last_completed_at: new Date().toISOString(),
              }
            : {
                sanitisation_next_due_date: calcNextDue(stepDate, processType),
                sanitisation_last_completed_at: new Date().toISOString(),
              };

        const { error: dispenserError } = await supabase
          .from('dispensers')
          .update(dispenserUpdate)
          .eq('id', stepItem.dispenser_id);

        if (dispenserError) throw dispenserError;
      }

      toast.success('Saved successfully');
      setStepItem(null);
      setAttachFile(null);
      await loadAll();
    } catch (err: unknown) {
      toast.error('Save failed', { description: (err as Error).message });
    } finally {
      setSaving(false);
      setAttachUploading(false);
    }
  };

  // ── Submit individual item to admin ────────────────────────────────────────
  const handleSubmitItem = async (item: DispenserCycleItem) => {
    if (!profile) return;
    setSubmitting(item.id);
    try {
      const { error } = await supabase
        .from('dispenser_cycle_items')
        .update({ status: 'submitted_to_admin' })
        .eq('id', item.id);
      if (error) throw error;
      toast.success('Submitted to admin for approval');
      await loadAll();
    } catch (err: unknown) {
      toast.error('Submit failed', { description: (err as Error).message });
    } finally {
      setSubmitting(null);
    }
  };

  // ── Individual PDF ─────────────────────────────────────────────────────────
  const handleIndividualPdf = async (item: DispenserCycleItem) => {
    if (!cycle) return;
    setPdfItem(item.id);
    try {
      const blob = await generateIndividualDispenserPdf(item, processType, cycle.vendor_full_name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dispenser-${item.serial_number || item.id.slice(0, 8)}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('PDF generation failed'); }
    finally { setPdfItem(null); }
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const processLabel = processType === 'sanitisation' ? 'Sanitisation' : 'Descaling';
  const lockLabel    = processType === 'descaling' ? '12 months' : '6 months';
  const ProcessIcon  = processType === 'sanitisation' ? Droplets : FlaskConical;

  const getNextStep = (item: DispenserCycleItem): StepMode | null => {
    if (item.status === 'pending' || item.status === 'rejected') return 'collect';
    if (item.status === 'in_process') return 'return';
    if (item.status === 'returned') return 'vendor_sign';
    return null;
  };

  const stepLabels: Record<StepMode, string> = {
    collect:     'Mark Collected',
    return:      'Mark Returned',
    vendor_sign: 'Sign & Complete',
  };

  // ── Item card renderer ─────────────────────────────────────────────────────
  const renderItemCard = (item: DispenserCycleItem) => {
    const nextStep = getNextStep(item);
    const isSubmitting = submitting === item.id;
    const isGeneratingPdf = pdfItem === item.id;

    return (
      <div key={item.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">
              {item.serial_number || 'S/N —'} · {item.model || '—'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{item.location_name || 'No location'}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[item.status] || 'bg-muted text-muted-foreground'}`}>
            {item.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Details row */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.collected_date && <span>Collected: <span className="text-foreground">{fmtDate(item.collected_date)}</span></span>}
          {item.collect_officer_name && <span>Officer: <span className="text-foreground">{item.collect_officer_name}</span></span>}
          {item.returned_date && <span>Returned: <span className="text-foreground">{fmtDate(item.returned_date)}</span></span>}
          {item.return_officer_name && <span>Return Officer: <span className="text-foreground">{item.return_officer_name}</span></span>}
          {item.next_due_date && <span className="col-span-2">Next due: <span className="font-medium text-foreground">{fmtDate(item.next_due_date)}</span> ({lockLabel} lock)</span>}
        </div>

        {/* Rejection note */}
        {item.status === 'rejected' && item.admin_comments && (
          <div className="flex items-start gap-1.5 rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700">
            <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Rejected: {item.admin_comments}</span>
          </div>
        )}

        {/* Attachment indicator for descaling */}
        {item.result_attachment_url && (
          <div className="flex items-center gap-1.5 text-xs text-blue-700">
            <Paperclip className="h-3 w-3" />
            <a href={item.result_attachment_url} target="_blank" rel="noreferrer" className="underline">Descaling result file</a>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {nextStep && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openStep(item, nextStep)}>
              <ArrowRight className="h-3 w-3" /> {stepLabels[nextStep]}
            </Button>
          )}
          {item.status === 'completed' && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1 bg-primary"
              onClick={() => handleSubmitItem(item)}
              disabled={isSubmitting}
            >
              <Send className="h-3 w-3" />
              {isSubmitting ? 'Submitting…' : 'Submit to Admin'}
            </Button>
          )}
          {item.status === 'submitted_to_admin' && (
            <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium py-1">
              <Clock className="h-3 w-3" /> Awaiting admin approval
            </span>
          )}
          {item.status === 'approved' && (
            <>
              <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium py-1">
                <CheckCircle2 className="h-3 w-3" /> Approved by {item.admin_full_name || 'admin'}
              </span>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => handleIndividualPdf(item)}
                disabled={isGeneratingPdf}
              >
                <Download className="h-3 w-3" />
                {isGeneratingPdf ? 'Generating…' : 'Download PDF'}
              </Button>
            </>
          )}
          {(item.status === 'returned' || item.status === 'completed' || item.status === 'submitted_to_admin') && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setDetailItem(item)}>
              <Eye className="h-3 w-3" /> Details
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <ProcessIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <VendorLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ProcessIcon className="h-6 w-6 text-primary" />
              {processLabel}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Collect, return, sign, and submit each dispenser individually · Lock period: <strong>{lockLabel}</strong>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 md:gap-3">
          {[
            { label: 'Pending',    value: pendingItems.length,    icon: AlertCircle,  color: 'text-muted-foreground', tab: 'pending' },
            { label: 'In Progress', value: inProgressItems.length, icon: ArrowRight,  color: 'text-orange-500',       tab: 'in_progress' },
            { label: 'Completed',  value: completedItems.length,  icon: CheckCircle2, color: 'text-green-600',        tab: 'completed' },
            { label: 'Locked',     value: lockedItems.length,     icon: Lock,         color: 'text-blue-500',         tab: 'locked' },
          ].map((s) => (
            <Card
              key={s.label}
              className={`shadow-sm cursor-pointer transition-colors ${activeTab === s.tab ? 'ring-2 ring-primary' : 'hover:bg-muted/30'}`}
              onClick={() => setActiveTab(s.tab)}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={`h-6 w-6 shrink-0 ${s.color}`} />
                <div className="min-w-0">
                  <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabbed dispenser list */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-1 hidden md:inline-flex">{pendingItems.length}</Badge></TabsTrigger>
            <TabsTrigger value="in_progress">In Progress <Badge variant="secondary" className="ml-1 hidden md:inline-flex">{inProgressItems.length}</Badge></TabsTrigger>
            <TabsTrigger value="completed">Completed <Badge variant="secondary" className="ml-1 hidden md:inline-flex">{completedItems.length}</Badge></TabsTrigger>
            <TabsTrigger value="locked">Locked <Badge variant="secondary" className="ml-1 hidden md:inline-flex">{lockedItems.length}</Badge></TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-3">
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Pending — needs collection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {loading ? (
                  <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded bg-muted" />)}</div>
                ) : pendingItems.length === 0 ? (
                  <EmptyState message="No pending dispensers — all have been collected or locked." />
                ) : (
                  <div className="space-y-2">{pendingItems.map(renderItemCard)}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="in_progress" className="mt-3">
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  In Progress — collected, awaiting return
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {loading ? (
                  <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-20 animate-pulse rounded bg-muted" />)}</div>
                ) : inProgressItems.length === 0 ? (
                  <EmptyState message="No dispensers in progress." />
                ) : (
                  <div className="space-y-2">{inProgressItems.map(renderItemCard)}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="mt-3">
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Completed — vendor signed, awaiting admin approval
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {loading ? (
                  <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-20 animate-pulse rounded bg-muted" />)}</div>
                ) : completedItems.length === 0 ? (
                  <EmptyState message="No completed dispensers yet." />
                ) : (
                  <div className="space-y-2">{completedItems.map(renderItemCard)}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locked" className="mt-3">
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Locked — approved, not due until lock period expires ({lockLabel})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {loading ? (
                  <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-muted" />)}</div>
                ) : lockedItems.length === 0 ? (
                  <EmptyState message="No locked dispensers." />
                ) : (
                  <div className="space-y-2">
                    {lockedItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {item.serial_number || 'S/N —'} · {item.model || '—'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{item.location_name || 'No location'}</p>
                          <p className="text-xs text-blue-700 mt-0.5">
                            <Lock className="h-3 w-3 inline mr-1" />
                            Locked until {fmtDate(item.next_due_date)} · Approved by {item.admin_full_name || 'admin'}
                          </p>
                        </div>
                        <Button
                          size="sm" variant="outline"
                          className="shrink-0 h-7 text-xs gap-1"
                          onClick={() => handleIndividualPdf(item)}
                          disabled={pdfItem === item.id}
                        >
                          <Download className="h-3 w-3" />
                          {pdfItem === item.id ? '…' : 'PDF'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Step dialog ── */}
      <Dialog open={!!stepItem} onOpenChange={(o) => { if (!o) { setStepItem(null); setAttachFile(null); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ProcessIcon className="h-4 w-4 text-primary" />
              {stepItem && stepLabels[stepMode]}
              {stepItem && <span className="text-muted-foreground font-normal ml-1 text-sm">— {stepItem.serial_number || stepItem.id.slice(0,8)}</span>}
            </DialogTitle>
          </DialogHeader>

          {stepItem && (
            <div className="space-y-4 py-1">
              {/* Date + Officer (not needed for vendor_sign) */}
              {stepMode !== 'vendor_sign' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="step-date">{stepMode === 'collect' ? 'Collection Date' : 'Return Date'} <span className="text-destructive">*</span></Label>
                    <Input id="step-date" type="date" value={stepDate} onChange={(e) => setStepDate(e.target.value)} className="px-3" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="step-officer">Officer Name <span className="text-destructive">*</span></Label>
                    <Input id="step-officer" placeholder="Full name of officer" value={stepOfficer} onChange={(e) => setStepOfficer(e.target.value)} className="px-3" />
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="step-notes">Notes (optional)</Label>
                <Textarea id="step-notes" placeholder="Any notes…" value={stepNotes} onChange={(e) => setStepNotes(e.target.value)} rows={2} className="px-3" />
              </div>

              {/* Descaling result attachment — only on vendor_sign for descaling */}
              {stepMode === 'return' && processType === 'descaling' && (
                <div className="space-y-1.5">
                  <Label>Descaling Result Attachment <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground">Upload the results document (PDF or image) from the descaling process.</p>
                  <input
                    ref={attachInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  />
                  {attachFile ? (
                    <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">{attachFile.name}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setAttachFile(null)}>Remove</Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => attachInputRef.current?.click()}>
                      <Paperclip className="h-3.5 w-3.5" /> Choose File
                    </Button>
                  )}
                </div>
              )}

              {/* Next due date preview */}
              {stepMode === 'return' && stepDate && (
                <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Next due date:</span>{' '}
                  {fmtDate(calcNextDue(stepDate, processType))}
                  {' '}({lockLabel} lock)
                </div>
              )}

              {/* Signature */}
              <div className="space-y-2">
                <Label>
                  {stepMode === 'collect' ? 'Collection Officer Signature' :
                   stepMode === 'return'  ? 'Return Officer Signature' :
                   'Vendor Completion Signature'}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                {sigSaved && sigDataUrl ? (
                  <div className="space-y-2">
                    <div className="rounded border border-border bg-white p-2">
                      <img src={sigDataUrl} alt="Signature" className="h-16 max-w-full object-contain" />
                    </div>
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => { setSigDataUrl(null); setSigSaved(false); sigRef.current?.clear(); }}>
                      Redo Signature
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded border-2 border-border bg-white">
                      <NativeSigCanvas ref={sigRef} penColor="#1E293B" canvasProps={{ width: 400, height: 120, className: 'w-full rounded' }} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => sigRef.current?.clear()}>Clear</Button>
                      <Button type="button" size="sm" onClick={handleSaveSig}>Save Signature</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setStepItem(null); setAttachFile(null); }} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveStep} disabled={saving || attachUploading || !sigSaved}>
              {saving || attachUploading ? 'Saving…' : 'Confirm & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail view dialog ── */}
      <Dialog open={!!detailItem} onOpenChange={(o) => { if (!o) setDetailItem(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispenser Details — {detailItem?.serial_number || '—'}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Serial #',     value: detailItem.serial_number || '—' },
                  { label: 'Model',        value: detailItem.model || '—' },
                  { label: 'Location',     value: detailItem.location_name || '—' },
                  { label: 'Status',       value: detailItem.status.replace(/_/g, ' ') },
                  { label: 'Collected',    value: fmtDate(detailItem.collected_date) },
                  { label: 'Collect Off.', value: detailItem.collect_officer_name || '—' },
                  { label: 'Returned',     value: fmtDate(detailItem.returned_date) },
                  { label: 'Return Off.',  value: detailItem.return_officer_name || '—' },
                  { label: 'Next Due',     value: fmtDate(detailItem.next_due_date) },
                ].map((f) => (
                  <div key={f.label} className="rounded bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="font-medium text-foreground capitalize">{f.value}</p>
                  </div>
                ))}
              </div>
              {detailItem.result_attachment_url && (
                <a href={detailItem.result_attachment_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-blue-700 underline text-sm">
                  <Paperclip className="h-4 w-4" /> View descaling result attachment
                </a>
              )}
              {detailItem.vendor_signature_url && (
                <div className="rounded border border-border p-2">
                  <p className="text-xs text-muted-foreground mb-1">Vendor Signature</p>
                  <img src={detailItem.vendor_signature_url} alt="Vendor sig" className="h-14 object-contain" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VendorLayout>
  );
};

export default VendorDispenserWorkflowPage;

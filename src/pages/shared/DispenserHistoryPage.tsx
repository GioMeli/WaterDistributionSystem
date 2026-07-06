/**
 * Dispenser History page — shared between admin and vendor roles.
 * Admin sees all cycles/items from all vendors.
 * Vendor sees only their own cycles/items.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  Search, Filter, FlaskConical, Droplets, Download,
  RotateCcw, Eye, Calendar,
} from 'lucide-react';
import { generateCycleSummaryPdf } from '@/utils/generateDispenserPdf';
import type { DispenserCycle, DispenserCycleItem } from '@/types/types';

interface Props {
  role: 'admin' | 'vendor';
}

const fmtDate = (d: string | null | undefined) =>
  d ? format(parseISO(d), 'dd MMM yyyy') : '—';

const statusColor: Record<string, string> = {
  open:               'bg-muted text-muted-foreground',
  submitted_to_admin: 'bg-orange-100 text-orange-700',
  approved:           'bg-green-100 text-green-700',
  rejected:           'bg-red-100 text-red-700',
};

const itemStatusColor: Record<string, string> = {
  pending:            'bg-muted text-muted-foreground',
  collected:          'bg-blue-100 text-blue-700',
  in_process:         'bg-yellow-100 text-yellow-700',
  returned:           'bg-purple-100 text-purple-700',
  completed:          'bg-green-100 text-green-700',
  submitted_to_admin: 'bg-orange-100 text-orange-700',
  approved:           'bg-green-200 text-green-800',
  rejected:           'bg-red-100 text-red-700',
};

const DispenserHistoryPage: React.FC<Props> = ({ role }) => {
  const { profile } = useAuth();
  const [cycles, setCycles] = useState<DispenserCycle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterProcess, setFilterProcess] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Detail view
  const [selectedCycle, setSelectedCycle] = useState<DispenserCycle | null>(null);
  const [cycleItems, setCycleItems] = useState<DispenserCycleItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    let query = supabase
      .from('dispenser_cycles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    // Vendor only sees their own
    if (role === 'vendor') {
      query = query.eq('vendor_id', profile.id);
    }

    const { data, error } = await query;
    if (error) toast.error('Failed to load history');
    setCycles((data as DispenserCycle[]) ?? []);
    setLoading(false);
  }, [profile, role]);

  useEffect(() => { load(); }, [load]);

  const loadItems = async (cycleId: string) => {
    setLoadingItems(true);
    const { data } = await supabase
      .from('dispenser_cycle_items')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('created_at');
    setCycleItems((data as DispenserCycleItem[]) ?? []);
    setLoadingItems(false);
  };

  const openDetail = async (cycle: DispenserCycle) => {
    setSelectedCycle(cycle);
    setCycleItems([]);
    await loadItems(cycle.id);
  };

  const handleDownloadPdf = async () => {
    if (!selectedCycle) return;
    setGeneratingPdf(true);
    try {
      const blob = await generateCycleSummaryPdf(selectedCycle, cycleItems);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cycle-${selectedCycle.process_type}-${selectedCycle.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF generation failed');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const filtered = cycles.filter((c) => {
    if (filterProcess !== 'all' && c.process_type !== filterProcess) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.vendor_full_name.toLowerCase().includes(q) &&
        !c.id.includes(q) &&
        !(c.admin_full_name || '').toLowerCase().includes(q)
      ) return false;
    }
    if (dateFrom && c.created_at < dateFrom) return false;
    if (dateTo && c.created_at > dateTo + 'T23:59:59') return false;
    return true;
  });

  const Layout = role === 'admin' ? AdminLayout : VendorLayout;

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" />
            Dispenser History
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {role === 'admin'
              ? 'Complete audit trail of all sanitisation & descaling cycle records'
              : 'Your sanitisation & descaling cycle history'}
          </p>
        </div>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-48">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={role === 'admin' ? 'Search vendor, admin, or ID…' : 'Search by cycle ID…'}
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={filterProcess} onValueChange={setFilterProcess}>
                <SelectTrigger className="h-9 w-40">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Process" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Processes</SelectItem>
                  <SelectItem value="sanitisation">Sanitisation</SelectItem>
                  <SelectItem value="descaling">Descaling</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="submitted_to_admin">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
                <span className="text-muted-foreground text-sm">—</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
              </div>
              {(search || filterProcess !== 'all' || filterStatus !== 'all' || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs"
                  onClick={() => { setSearch(''); setFilterProcess('all'); setFilterStatus('all'); setDateFrom(''); setDateTo(''); }}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Cycles',    value: filtered.length },
            { label: 'Approved',        value: filtered.filter((c) => c.status === 'approved').length },
            { label: 'Pending Review',  value: filtered.filter((c) => c.status === 'submitted_to_admin').length },
            { label: 'Rejected',        value: filtered.filter((c) => c.status === 'rejected').length },
          ].map((s) => (
            <Card key={s.label} className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cycles table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Cycle Records <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <RotateCcw className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium">No records found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['ID', 'Process', 'Vendor', 'Status', 'Created', 'Submitted', 'Admin', 'Approved', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.id.slice(0, 8).toUpperCase()}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 capitalize font-medium text-foreground">
                            {c.process_type === 'sanitisation'
                              ? <Droplets className="h-3.5 w-3.5" />
                              : <FlaskConical className="h-3.5 w-3.5" />}
                            {c.process_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground">{c.vendor_full_name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] || ''}`}>
                            {c.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.submitted_at)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.admin_full_name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.admin_approved_at)}</td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openDetail(c)}>
                            <Eye className="h-3.5 w-3.5" /> View
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
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCycle} onOpenChange={(o) => { if (!o) { setSelectedCycle(null); setCycleItems([]); } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Cycle Detail — <span className="capitalize">{selectedCycle?.process_type}</span>
              <span className="font-mono text-sm text-muted-foreground">
                ({selectedCycle?.id.slice(0, 8).toUpperCase()})
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedCycle && (
            <div className="space-y-4">
              {/* Meta grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { label: 'Vendor',     value: selectedCycle.vendor_full_name },
                  { label: 'Status',     value: selectedCycle.status.replace(/_/g, ' ') },
                  { label: 'Submitted',  value: fmtDate(selectedCycle.submitted_at) },
                  { label: 'Admin',      value: selectedCycle.admin_full_name || '—' },
                  { label: 'Created',    value: fmtDate(selectedCycle.created_at) },
                  { label: 'Approved',   value: fmtDate(selectedCycle.admin_approved_at) },
                ].map((f) => (
                  <div key={f.label} className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">{f.label}</p>
                    <p className="font-medium text-foreground capitalize">{f.value}</p>
                  </div>
                ))}
              </div>

              {selectedCycle.admin_comments && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                  <strong>Admin comments:</strong> {selectedCycle.admin_comments}
                </div>
              )}

              {/* Items table */}
              {loadingItems ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        {['#', 'Serial #', 'Location', 'Collected', 'Collect Officer', 'Returned', 'Return Officer', 'Status', 'Next Due'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cycleItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-muted/10">
                          <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.serial_number || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.location_name || '—'}</td>
                          <td className="px-3 py-2">{fmtDate(item.collected_date)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.collect_officer_name || '—'}</td>
                          <td className="px-3 py-2">{fmtDate(item.returned_date)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.return_officer_name || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${itemStatusColor[item.status] || ''}`}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{fmtDate(item.next_due_date)}</td>
                        </tr>
                      ))}
                      {cycleItems.length === 0 && (
                        <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No items in this cycle.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedCycle.vendor_signature_url && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">VENDOR SIGNATURE</p>
                    <img src={selectedCycle.vendor_signature_url} alt="Vendor signature" className="h-16 object-contain" />
                  </div>
                )}
                {selectedCycle.admin_signature_url && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-semibold text-green-700 mb-2">
                      ADMIN APPROVAL SIGNATURE — {selectedCycle.admin_full_name}
                    </p>
                    <img src={selectedCycle.admin_signature_url} alt="Admin signature" className="h-16 object-contain" />
                  </div>
                )}
              </div>

              {/* PDF download */}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={generatingPdf} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  {generatingPdf ? 'Generating…' : 'Download PDF Report'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default DispenserHistoryPage;

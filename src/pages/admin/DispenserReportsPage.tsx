import React, { useState, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO, addDays } from 'date-fns';
import {
  BarChart2, Download, AlertCircle, CalendarDays,
  CheckCircle2, Clock, FileText, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateMonthlyPaymentPdf } from '@/utils/generateDispenserPdf';
import type { DispenserCycleItem, Profile } from '@/types/types';

type ReportItem = DispenserCycleItem & {
  process_type?: string;
  vendor_full_name?: string;
};

const fmtDate = (d: string | null | undefined) =>
  d ? format(parseISO(d), 'dd MMM yyyy') : '—';

const DispenserReportsPage: React.FC = () => {
  const { profile } = useAuth();
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);

  // History tab
  const [historyItems, setHistoryItems] = useState<ReportItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyProcess, setHistoryProcess] = useState('all');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [historyVendor, setHistoryVendor] = useState('all');

  // Due dates tab
  const [dueItems, setDueItems] = useState<{ id: string; serial_number: string | null; model: string | null; location_name: string | null; next_due_date: string | null; last_completed_at: string | null; is_active: boolean }[]>([]);
  const [dueLoading, setDueLoading] = useState(false);
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'due_soon'>('all');

  // Monthly tab
  const [monthlyMonth, setMonthlyMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [monthlyYear, setMonthlyYear] = useState(String(new Date().getFullYear()));
  const [monthlyProcess, setMonthlyProcess] = useState('both');
  const [monthlyVendor, setMonthlyVendor] = useState('all');
  const [monthlyItems, setMonthlyItems] = useState<ReportItem[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const loadVendors = useCallback(async () => {
    if (vendorsLoaded) return;
    const { data } = await supabase.from('profiles').select('id,full_name,email').eq('role', 'vendor').order('full_name');
    setVendors((data as Profile[]) ?? []);
    setVendorsLoaded(true);
  }, [vendorsLoaded]);

  // ── History ─────────────────────────────────────────────────────────────────
  const loadHistory = async () => {
    setHistoryLoading(true);
    let q = supabase
      .from('dispenser_cycle_items')
      .select('*, cycle:dispenser_cycles(process_type,vendor_full_name,status)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (historyStart) q = q.gte('returned_date', historyStart);
    if (historyEnd)   q = q.lte('returned_date', historyEnd);

    const { data, error } = await q;
    if (error) { toast.error('Failed to load history'); setHistoryLoading(false); return; }

    let rows: ReportItem[] = (data ?? []).map((item: ReportItem & { cycle?: { process_type: string; vendor_full_name: string } }) => ({
      ...item,
      process_type: item.cycle?.process_type,
      vendor_full_name: item.cycle?.vendor_full_name,
    }));

    if (historyProcess !== 'all') rows = rows.filter((r) => r.process_type === historyProcess);
    if (historyVendor !== 'all') rows = rows.filter((r) => {
      // match by vendor name (no direct vendor_id on items)
      const v = vendors.find((vv) => vv.id === historyVendor);
      return v ? r.vendor_full_name === (v.full_name || v.email) : true;
    });

    setHistoryItems(rows);
    setHistoryLoading(false);
  };

  const exportHistoryCsv = () => {
    if (!historyItems.length) return;
    const rows = historyItems.map((item) => ({
      'Process': item.process_type || '',
      'Vendor': item.vendor_full_name || '',
      'Serial #': item.serial_number || '',
      'Model': item.model || '',
      'Location': item.location_name || '',
      'Collected Date': item.collected_date || '',
      'Returned Date': item.returned_date || '',
      'Collect Officer': item.collect_officer_name || '',
      'Return Officer': item.return_officer_name || '',
      'Status': item.status,
      'Next Due': item.next_due_date || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispenser History');
    XLSX.writeFile(wb, `dispenser-history-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('History exported');
  };

  // ── Due Dates ────────────────────────────────────────────────────────────────
  const loadDueDates = async () => {
    setDueLoading(true);
    const { data, error } = await supabase
      .from('dispensers')
      .select('id,serial_number,model,next_due_date,last_completed_at,is_active,location:locations(office_name)')
      .eq('is_active', true)
      .order('next_due_date', { ascending: true, nullsFirst: false });
    if (error) { toast.error('Failed to load due dates'); setDueLoading(false); return; }

    const items = ((data ?? []) as Array<{
      id: string; serial_number: string | null; model: string | null;
      next_due_date: string | null; last_completed_at: string | null; is_active: boolean;
      location: { office_name: string } | { office_name: string }[] | null;
    }>).map((d) => {
      const loc = Array.isArray(d.location) ? d.location[0] : d.location;
      return {
        id: d.id,
        serial_number: d.serial_number,
        model: d.model,
        location_name: loc?.office_name || null,
        next_due_date: d.next_due_date,
        last_completed_at: d.last_completed_at,
        is_active: d.is_active,
      };
    });

    setDueItems(items);
    setDueLoading(false);
  };

  const filteredDue = dueItems.filter((d) => {
    if (dueFilter === 'all') return true;
    if (!d.next_due_date) return dueFilter === 'overdue';
    const due = parseISO(d.next_due_date);
    if (dueFilter === 'overdue') return due < new Date();
    if (dueFilter === 'due_soon') return due >= new Date() && due <= addDays(new Date(), 30);
    return true;
  });

  const exportDueCsv = () => {
    if (!filteredDue.length) return;
    const rows = filteredDue.map((d) => ({
      'Serial #': d.serial_number || '',
      'Model': d.model || '',
      'Location': d.location_name || '',
      'Next Due Date': d.next_due_date || '',
      'Last Completed': d.last_completed_at ? format(parseISO(d.last_completed_at), 'dd MMM yyyy') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Due Dates');
    XLSX.writeFile(wb, `dispenser-due-dates-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Due dates exported');
  };

  // ── Monthly ──────────────────────────────────────────────────────────────────
  const loadMonthly = async () => {
    setMonthlyLoading(true);
    const year = parseInt(monthlyYear);
    const month = parseInt(monthlyMonth);
    const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
    const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');

    let q = supabase
      .from('dispenser_cycle_items')
      .select('*, cycle:dispenser_cycles(process_type,vendor_full_name,vendor_id)')
      .gte('returned_date', startDate)
      .lte('returned_date', endDate)
      .in('status', ['completed', 'approved'])
      .order('returned_date');

    const { data, error } = await q;
    if (error) { toast.error('Failed to load monthly data'); setMonthlyLoading(false); return; }

    let rows: ReportItem[] = (data ?? []).map((item: ReportItem & { cycle?: { process_type: string; vendor_full_name: string; vendor_id: string } }) => ({
      ...item,
      process_type: item.cycle?.process_type,
      vendor_full_name: item.cycle?.vendor_full_name,
    }));

    if (monthlyProcess !== 'both') rows = rows.filter((r) => r.process_type === monthlyProcess);

    if (monthlyVendor !== 'all') {
      const v = vendors.find((vv) => vv.id === monthlyVendor);
      if (v) rows = rows.filter((r) => r.vendor_full_name === (v.full_name || v.email));
    }

    setMonthlyItems(rows);
    setMonthlyLoading(false);
  };

  const handleMonthlyPdf = async () => {
    if (!monthlyItems.length) { toast.error('No data to export'); return; }
    setGeneratingPdf(true);
    try {
      const vendorName = monthlyVendor !== 'all'
        ? (vendors.find((v) => v.id === monthlyVendor)?.full_name || 'All Vendors')
        : 'All Vendors';
      const blob = await generateMonthlyPaymentPdf({
        month: parseInt(monthlyMonth),
        year: parseInt(monthlyYear),
        processType: monthlyProcess,
        vendorName,
        items: monthlyItems,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        adminApproved: false,
        adminName: profile?.full_name || profile?.email,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly-report-${monthlyYear}-${monthlyMonth}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF generation failed');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const exportMonthlyExcel = () => {
    if (!monthlyItems.length) { toast.error('No data to export'); return; }
    const rows = monthlyItems.map((item) => ({
      'Process': item.process_type || '',
      'Vendor': item.vendor_full_name || '',
      'Serial #': item.serial_number || '',
      'Model': item.model || '',
      'Location': item.location_name || '',
      'Collected Date': item.collected_date || '',
      'Returned Date': item.returned_date || '',
      'Collect Officer': item.collect_officer_name || '',
      'Return Officer': item.return_officer_name || '',
      'Status': item.status,
      'Next Due': item.next_due_date || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');
    XLSX.writeFile(wb, `monthly-dispenser-${monthlyYear}-${monthlyMonth}.xlsx`);
    toast.success('Excel exported');
  };

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i));
  const months = [
    { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
    { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
    { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            Dispenser Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            History, due dates, overdue dispensers, and monthly payment reports
          </p>
        </div>

        <Tabs defaultValue="history">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="history" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> History</TabsTrigger>
            <TabsTrigger value="due" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Due Dates</TabsTrigger>
            <TabsTrigger value="monthly" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Monthly Payment</TabsTrigger>
          </TabsList>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Process</Label>
                    <Select value={historyProcess} onValueChange={setHistoryProcess}>
                      <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Processes</SelectItem>
                        <SelectItem value="sanitisation">Sanitisation</SelectItem>
                        <SelectItem value="descaling">Descaling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input type="date" value={historyStart} onChange={(e) => setHistoryStart(e.target.value)} className="h-9 w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input type="date" value={historyEnd} onChange={(e) => setHistoryEnd(e.target.value)} className="h-9 w-40" />
                  </div>
                  <Button size="sm" className="gap-1.5 h-9 self-end" onClick={() => { loadVendors(); loadHistory(); }}>
                    <RefreshCw className="h-3.5 w-3.5" /> Load
                  </Button>
                  {historyItems.length > 0 && (
                    <Button variant="outline" size="sm" className="gap-1.5 h-9 self-end" onClick={exportHistoryCsv}>
                      <Download className="h-3.5 w-3.5" /> Export Excel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  History <Badge variant="secondary" className="ml-1">{historyItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
                ) : historyItems.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <BarChart2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="font-medium">No data yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Apply filters and click Load.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {['Process', 'Vendor', 'Serial #', 'Location', 'Collected', 'Returned', 'Status', 'Next Due'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {historyItems.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/10">
                            <td className="px-4 py-2.5 capitalize text-foreground">{item.process_type || '—'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{item.vendor_full_name || '—'}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-foreground">{item.serial_number || '—'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{item.location_name || '—'}</td>
                            <td className="px-4 py-2.5 text-foreground">{fmtDate(item.collected_date)}</td>
                            <td className="px-4 py-2.5 text-foreground">{fmtDate(item.returned_date)}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="secondary" className="capitalize text-xs">
                                {item.status.replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(item.next_due_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Due Dates Tab ── */}
          <TabsContent value="due" className="space-y-4 mt-4">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Filter</Label>
                    <Select value={dueFilter} onValueChange={(v) => setDueFilter(v as typeof dueFilter)}>
                      <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Active</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="due_soon">Due in 30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" className="gap-1.5 h-9 self-end" onClick={loadDueDates}>
                    <RefreshCw className="h-3.5 w-3.5" /> Load
                  </Button>
                  {filteredDue.length > 0 && (
                    <Button variant="outline" size="sm" className="gap-1.5 h-9 self-end" onClick={exportDueCsv}>
                      <Download className="h-3.5 w-3.5" /> Export Excel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Overdue', count: dueItems.filter((d) => d.next_due_date && parseISO(d.next_due_date) < new Date()).length, icon: AlertCircle, color: 'text-destructive' },
                { label: 'Due Soon (30d)', count: dueItems.filter((d) => d.next_due_date && parseISO(d.next_due_date) >= new Date() && parseISO(d.next_due_date) <= addDays(new Date(), 30)).length, icon: CalendarDays, color: 'text-orange-500' },
                { label: 'No Due Date', count: dueItems.filter((d) => !d.next_due_date).length, icon: CheckCircle2, color: 'text-muted-foreground' },
              ].map((s) => (
                <Card key={s.label} className="shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <s.icon className={`h-8 w-8 ${s.color}`} />
                    <div>
                      <p className="text-2xl font-bold text-foreground">{s.count}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Dispensers <Badge variant="secondary" className="ml-1">{filteredDue.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {dueLoading ? (
                  <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
                ) : filteredDue.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="font-medium">No dispensers</p>
                    <p className="text-sm text-muted-foreground mt-1">Click Load to fetch data.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {['Serial #', 'Model', 'Location', 'Next Due', 'Last Completed', 'State'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredDue.map((d) => {
                          const due = d.next_due_date ? parseISO(d.next_due_date) : null;
                          const isOverdue = due && due < new Date();
                          const isDueSoon = due && due >= new Date() && due <= addDays(new Date(), 30);
                          return (
                            <tr key={d.id} className="hover:bg-muted/10">
                              <td className="px-4 py-2.5 font-mono text-xs text-foreground">{d.serial_number || '—'}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{d.model || '—'}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{d.location_name || '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className={isOverdue ? 'text-destructive font-semibold' : isDueSoon ? 'text-orange-500 font-medium' : 'text-foreground'}>
                                  {d.next_due_date ? format(parseISO(d.next_due_date), 'dd MMM yyyy') : '—'}
                                  {isOverdue && ' ⚠'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {d.last_completed_at ? format(parseISO(d.last_completed_at), 'dd MMM yyyy') : '—'}
                              </td>
                              <td className="px-4 py-2.5">
                                {isOverdue ? (
                                  <Badge variant="destructive" className="text-xs">Overdue</Badge>
                                ) : isDueSoon ? (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">Due Soon</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">OK</Badge>
                                )}
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
          </TabsContent>

          {/* ── Monthly Payment Tab ── */}
          <TabsContent value="monthly" className="space-y-4 mt-4">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Month</Label>
                    <Select value={monthlyMonth} onValueChange={setMonthlyMonth}>
                      <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Year</Label>
                    <Select value={monthlyYear} onValueChange={setMonthlyYear}>
                      <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Process</Label>
                    <Select value={monthlyProcess} onValueChange={setMonthlyProcess}>
                      <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both</SelectItem>
                        <SelectItem value="sanitisation">Sanitisation</SelectItem>
                        <SelectItem value="descaling">Descaling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vendor</Label>
                    <Select value={monthlyVendor} onValueChange={setMonthlyVendor}>
                      <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.full_name || v.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Amount (optional)</Label>
                    <Input type="number" placeholder="0.00" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="h-9 w-32" />
                  </div>
                  <Button size="sm" className="gap-1.5 h-9 self-end" onClick={() => { loadVendors(); loadMonthly(); }}>
                    <RefreshCw className="h-3.5 w-3.5" /> Load
                  </Button>
                </div>
              </CardContent>
            </Card>

            {monthlyItems.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportMonthlyExcel}>
                  <Download className="h-3.5 w-3.5" /> Export Excel
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleMonthlyPdf} disabled={generatingPdf}>
                  <FileText className="h-3.5 w-3.5" />
                  {generatingPdf ? 'Generating…' : 'Download PDF'}
                </Button>
              </div>
            )}

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Completed Items <Badge variant="secondary" className="ml-1">{monthlyItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {monthlyLoading ? (
                  <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
                ) : monthlyItems.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="font-medium">No completed items</p>
                    <p className="text-sm text-muted-foreground mt-1">Select month and click Load.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {['Process', 'Vendor', 'Serial #', 'Location', 'Collected', 'Returned', 'Return Officer', 'Next Due'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {monthlyItems.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/10">
                            <td className="px-4 py-2.5 capitalize text-foreground">{item.process_type || '—'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{item.vendor_full_name || '—'}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-foreground">{item.serial_number || '—'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{item.location_name || '—'}</td>
                            <td className="px-4 py-2.5 text-foreground">{fmtDate(item.collected_date)}</td>
                            <td className="px-4 py-2.5 text-foreground">{fmtDate(item.returned_date)}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{item.return_officer_name || '—'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(item.next_due_date)}</td>
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
    </AdminLayout>
  );
};

export default DispenserReportsPage;

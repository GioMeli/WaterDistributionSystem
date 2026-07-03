import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllVendors } from '@/services/api';
import { supabase } from '@/db/supabase';
import type { Profile } from '@/types/types';
import { format, parseISO, getMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import { Download, Filter, BarChart2, TrendingUp, Package, MapPin, Sun, Leaf, Snowflake, Flower2 } from 'lucide-react';
import { toast } from 'sonner';

const CHART_COLORS = ['#2563EB', '#EA580C', '#16A34A', '#9333EA', '#DC2626', '#0891B2'];

interface ReportItem {
  id: string;
  delivery_id: string;
  route_number: string;
  building_number: string;
  office_name: string;
  sup_number: string;
  estimated_bottles: number;
  issued_quantity: number;
  received_quantity: number;
  officer_name: string | null;
  no_issue_needed: boolean;
  status: string;
  notes: string | null;
  delivery: {
    id: string;
    delivery_date: string;
    status: string;
    vendor_full_name: string;
    admin_full_name: string | null;
    approved_at: string | null;
    vendor?: { full_name: string } | null;
  } | null;
}

const ReportsPage: React.FC = () => {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'charts' | 'tables' | 'locations' | 'seasonal'>('charts');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [noIssueOnly, setNoIssueOnly] = useState(false);
  const [minIssued, setMinIssued] = useState('');
  const [maxIssued, setMaxIssued] = useState('');

  useEffect(() => {
    getAllVendors().then(({ data }) => setVendors(data));
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('delivery_location_items')
      .select(`
        id, delivery_id, route_number, building_number, office_name, sup_number,
        estimated_bottles, issued_quantity, received_quantity, officer_name,
        no_issue_needed, status, notes,
        delivery:deliveries!delivery_location_items_delivery_id_fkey(
          id, delivery_date, status, vendor_full_name, admin_full_name, approved_at,
          vendor:profiles!deliveries_vendor_id_fkey(full_name)
        )
      `)
      .order('delivery_id');

    const { data, error } = await query.limit(3000);
    if (error) { toast.error('Failed to load report data'); }
    setItems((data as unknown as ReportItem[]) ?? []);
    setLoading(false);
  }, []);

  // Apply filters
  const filtered = items.filter((item) => {
    const d = item.delivery;
    if (!d) return false;
    if (startDate && d.delivery_date < startDate) return false;
    if (endDate && d.delivery_date > endDate) return false;
    if (selectedVendor !== 'all' && d.vendor?.full_name !== vendors.find((v) => v.id === selectedVendor)?.full_name) return false;
    if (selectedStatus !== 'all' && d.status !== selectedStatus) return false;
    if (noIssueOnly && !item.no_issue_needed) return false;
    if (minIssued && item.issued_quantity < Number(minIssued)) return false;
    if (maxIssued && item.issued_quantity > Number(maxIssued)) return false;
    return true;
  });

  const totalIssued = filtered.reduce((s, i) => s + i.issued_quantity, 0);
  const totalReceived = filtered.reduce((s, i) => s + i.received_quantity, 0);
  const noIssueCount = filtered.filter((i) => i.no_issue_needed).length;
  const uniqueDeliveries = new Set(filtered.map((i) => i.delivery_id)).size;
  const uniqueLocations = new Set(filtered.map((i) => i.office_name)).size;

  // Monthly consumption
  const monthlyMap: Record<string, { issued: number; received: number }> = {};
  filtered.forEach((item) => {
    if (!item.delivery?.delivery_date) return;
    const key = format(parseISO(item.delivery.delivery_date), 'MMM yyyy');
    if (!monthlyMap[key]) monthlyMap[key] = { issued: 0, received: 0 };
    monthlyMap[key].issued += item.issued_quantity;
    monthlyMap[key].received += item.received_quantity;
  });
  const monthlyData = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }));

  // By location (with all metrics + delivery count)
  const locationMap: Record<string, { estimated: number; issued: number; received: number; deliveries: Set<string> }> = {};
  filtered.forEach((i) => {
    if (!locationMap[i.office_name]) {
      locationMap[i.office_name] = { estimated: 0, issued: 0, received: 0, deliveries: new Set() };
    }
    locationMap[i.office_name].estimated += i.estimated_bottles;
    locationMap[i.office_name].issued    += i.issued_quantity;
    locationMap[i.office_name].received  += i.received_quantity;
    if (i.delivery_id) locationMap[i.office_name].deliveries.add(i.delivery_id);
  });
  const locationData = Object.entries(locationMap)
    .map(([name, v]) => ({ name, estimated: v.estimated, issued: v.issued, received: v.received, deliveries: v.deliveries.size }))
    .sort((a, b) => b.issued - a.issued)
    .slice(0, 10);

  // Location chart data (top 10 for chart)
  const locationChartData = locationData.slice(0, 10);

  // By vendor
  const vendorMap: Record<string, number> = {};
  filtered.forEach((i) => {
    const vname = i.delivery?.vendor_full_name || 'Unknown';
    vendorMap[vname] = (vendorMap[vname] || 0) + i.issued_quantity;
  });
  const vendorData = Object.entries(vendorMap).map(([name, issued]) => ({ name, issued }));

  // ── Seasonal estimates ────────────────────────────────────────────────────
  const SEASONS: { name: string; months: number[]; icon: React.ElementType; color: string }[] = [
    { name: 'Spring',  months: [3, 4, 5],     icon: Flower2,   color: '#16A34A' },
    { name: 'Summer',  months: [6, 7, 8],     icon: Sun,       color: '#F59E0B' },
    { name: 'Autumn',  months: [9, 10, 11],   icon: Leaf,      color: '#EA580C' },
    { name: 'Winter',  months: [12, 1, 2],    icon: Snowflake, color: '#2563EB' },
  ];

  // Build per-year totals for each season to compute the historical average
  // yearlySeasonMap[seasonName][year] = total issued that year+season
  const yearlySeasonMap: Record<string, Record<number, number>> = {
    Spring: {}, Summer: {}, Autumn: {}, Winter: {},
  };
  const seasonalMap: Record<string, { issued: number; received: number; deliveries: Set<string> }> = {
    Spring: { issued: 0, received: 0, deliveries: new Set() },
    Summer: { issued: 0, received: 0, deliveries: new Set() },
    Autumn: { issued: 0, received: 0, deliveries: new Set() },
    Winter: { issued: 0, received: 0, deliveries: new Set() },
  };
  // Use ALL loaded items (not just filtered) for the estimate computation so
  // the average reflects complete historical data regardless of filters.
  items.forEach((item) => {
    if (!item.delivery?.delivery_date) return;
    const dt    = parseISO(item.delivery.delivery_date);
    const month = getMonth(dt) + 1; // 1-12
    const year  = dt.getFullYear();
    const season = SEASONS.find((s) => s.months.includes(month));
    if (!season) return;
    yearlySeasonMap[season.name][year] = (yearlySeasonMap[season.name][year] ?? 0) + item.issued_quantity;
  });
  // Estimate = average of per-year totals across all historical years
  const seasonEstimate = (seasonName: string): number => {
    const yearTotals = Object.values(yearlySeasonMap[seasonName]);
    if (yearTotals.length === 0) return 0;
    return Math.round(yearTotals.reduce((a, b) => a + b, 0) / yearTotals.length);
  };

  // Actuals computed from the filtered set (respects date/vendor/status filters)
  filtered.forEach((item) => {
    if (!item.delivery?.delivery_date) return;
    const month  = getMonth(parseISO(item.delivery.delivery_date)) + 1;
    const season = SEASONS.find((s) => s.months.includes(month));
    if (!season) return;
    seasonalMap[season.name].issued   += item.issued_quantity;
    seasonalMap[season.name].received += item.received_quantity;
    if (item.delivery_id) seasonalMap[season.name].deliveries.add(item.delivery_id);
  });
  const seasonalData = SEASONS.map((s) => ({
    name:      s.name,
    color:     s.color,
    estimate:  seasonEstimate(s.name),   // avg issued per season across all years
    issued:    seasonalMap[s.name].issued,
    received:  seasonalMap[s.name].received,
    deliveries: seasonalMap[s.name].deliveries.size,
  }));

  // Export CSV
  const exportCSV = () => {
    const rows = [
      ['Delivery Date', 'Vendor', 'Route No', 'Building', 'Office', 'SUP No', 'Est. Bottles', 'Issued', 'Received', 'Difference', 'Officer', 'Status', 'No Issue', 'Notes', 'Approved By', 'Approved Date'],
      ...filtered.map((i) => [
        i.delivery?.delivery_date || '',
        i.delivery?.vendor_full_name || '',
        i.route_number, i.building_number, i.office_name, i.sup_number,
        i.estimated_bottles, i.issued_quantity, i.received_quantity,
        i.issued_quantity - i.received_quantity,
        i.officer_name || '', i.status,
        i.no_issue_needed ? 'Yes' : 'No',
        i.notes || '',
        i.delivery?.admin_full_name || '',
        i.delivery?.approved_at ? format(parseISO(i.delivery.approved_at), 'dd/MM/yyyy') : '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water_distribution_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // Export Excel
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Detailed Data
    const detailedRows = filtered.map((i) => ({
      'Delivery Date': i.delivery?.delivery_date || '',
      'Vendor': i.delivery?.vendor_full_name || '',
      'Route No': i.route_number,
      'Building': i.building_number,
      'Office Name': i.office_name,
      'SUP No': i.sup_number,
      'Est. Bottles': i.estimated_bottles,
      'Issued': i.issued_quantity,
      'Received': i.received_quantity,
      'Difference': i.issued_quantity - i.received_quantity,
      'Officer': i.officer_name || '',
      'Status': i.status,
      'No Issue': i.no_issue_needed ? 'Yes' : 'No',
      'Notes': i.notes || '',
      'Approved By': i.delivery?.admin_full_name || '',
      'Approved Date': i.delivery?.approved_at ? format(parseISO(i.delivery.approved_at), 'dd/MM/yyyy') : '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailedRows), 'Detailed Data');

    // Sheet 2: Summary by Location
    const locSummary = locationData.map((row) => ({
      'Office Name': row.name,
      'Deliveries': row.deliveries,
      'Est. Issues': row.issued,
      'Total Issued': row.issued,
      'Total Received': row.received,
      'Difference': row.issued - row.received,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(locSummary), 'By Location');

    // Sheet 3: Summary by Building
    const bldgMap: Record<string, number> = {};
    filtered.forEach((i) => { bldgMap[i.building_number] = (bldgMap[i.building_number] || 0) + i.issued_quantity; });
    const bldgSummary = Object.entries(bldgMap).map(([b, issued]) => ({ 'Building': b, 'Total Issued': issued }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bldgSummary), 'By Building');

    // Sheet 4: Monthly Summary
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyData.map((m) => ({
      'Month': m.month, 'Issued': m.issued, 'Received': m.received,
    }))), 'Monthly Summary');

    // Sheet 5: No Issue Summary
    const noIssueLoc: Record<string, number> = {};
    filtered.filter((i) => i.no_issue_needed).forEach((i) => {
      noIssueLoc[i.office_name] = (noIssueLoc[i.office_name] || 0) + 1;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      Object.entries(noIssueLoc).map(([office, count]) => ({ 'Office Name': office, 'No Issue Count': count }))
    ), 'No Issue Summary');

    XLSX.writeFile(wb, `water_distribution_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exported');
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel}>
              <Download className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vendor</Label>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vendors</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.full_name || v.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="submitted_to_admin">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="finalised">Finalised</SelectItem>
                    <SelectItem value="rejected_by_admin">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Issued</Label>
                <Input type="number" min="0" value={minIssued} onChange={(e) => setMinIssued(e.target.value)} className="h-9" placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Issued</Label>
                <Input type="number" min="0" value={maxIssued} onChange={(e) => setMaxIssued(e.target.value)} className="h-9" placeholder="999" />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2 pb-1">
                  <Checkbox id="noIssueFilter" checked={noIssueOnly} onCheckedChange={(c) => setNoIssueOnly(c as boolean)} />
                  <Label htmlFor="noIssueFilter" className="cursor-pointer text-xs">No Issue Only</Label>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setStartDate(''); setEndDate(''); setSelectedVendor('all');
                    setSelectedStatus('all'); setNoIssueOnly(false); setMinIssued(''); setMaxIssued('');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Total Issued', value: totalIssued.toLocaleString(), icon: Package, color: 'text-primary' },
            { label: 'Total Received', value: totalReceived.toLocaleString(), icon: TrendingUp, color: 'text-green-600' },
            { label: 'Difference', value: (totalIssued - totalReceived).toLocaleString(), icon: BarChart2, color: 'text-orange-600' },
            { label: 'Deliveries', value: uniqueDeliveries, icon: Package, color: 'text-blue-600' },
            { label: 'No Issue Entries', value: noIssueCount, icon: Package, color: 'text-gray-500' },
          ].map((s) => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="p-4">
                <s.icon className={`h-4 w-4 mb-1 ${s.color}`} />
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'charts',    label: 'Charts'           },
            { key: 'tables',    label: 'Detail Table'     },
            { key: 'locations', label: 'By Location'      },
            { key: 'seasonal',  label: 'Seasonal Estimates'},
          ] as const).map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* ── CHARTS ── */}
        {!loading && activeTab === 'charts' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly Consumption</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                      <Bar dataKey="issued" fill={CHART_COLORS[0]} name="Issued" />
                      <Bar dataKey="received" fill={CHART_COLORS[2]} name="Received" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 10 Locations by Issued</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={locationChartData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="issued" fill={CHART_COLORS[0]} name="Issued" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Consumption by Vendor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={vendorData} dataKey="issued" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${Math.round(percent * 100)}%)`}>
                        {vendorData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Issued vs Received Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={monthlyData}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                      <Line type="monotone" dataKey="issued" stroke={CHART_COLORS[0]} name="Issued" strokeWidth={2} />
                      <Line type="monotone" dataKey="received" stroke={CHART_COLORS[2]} name="Received" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── DETAIL TABLE ── */}
        {!loading && activeTab === 'tables' && (
          <div className="space-y-5">
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Detailed Delivery Records ({filtered.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        {['Date', 'Vendor', 'Route', 'Building', 'Office', 'SUP', 'Issued', 'Received', 'Diff', 'Status', 'No Issue'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.slice(0, 100).map((item) => (
                        <tr key={item.id} className="hover:bg-muted/10">
                          <td className="px-3 py-2 text-foreground">{item.delivery?.delivery_date || '—'}</td>
                          <td className="px-3 py-2 text-foreground">{item.delivery?.vendor_full_name || '—'}</td>
                          <td className="px-3 py-2 text-foreground">{item.route_number}</td>
                          <td className="px-3 py-2 text-foreground">{item.building_number}</td>
                          <td className="max-w-xs px-3 py-2 text-foreground">{item.office_name}</td>
                          <td className="px-3 py-2 text-foreground">{item.sup_number}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{item.issued_quantity}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{item.received_quantity}</td>
                          <td className="px-3 py-2 text-foreground">{item.issued_quantity - item.received_quantity}</td>
                          <td className="px-3 py-2 text-foreground capitalize">{item.status.replace(/_/g, ' ')}</td>
                          <td className="px-3 py-2 text-foreground">{item.no_issue_needed ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 100 && (
                    <p className="px-4 py-2 text-xs text-muted-foreground">
                      Showing first 100 of {filtered.length} records. Export to see all data.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── BY LOCATION ── */}
        {!loading && activeTab === 'locations' && (
          <div className="space-y-5">
            {/* chart */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-primary" />
                  Deliveries by Location — Selected Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={locationChartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                      <Tooltip formatter={(value, name) => [value.toLocaleString(), name]} />
                      <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                      <Bar dataKey="estimated" fill={CHART_COLORS[4]} name="Estimated" />
                      <Bar dataKey="issued"    fill={CHART_COLORS[0]} name="Issued" />
                      <Bar dataKey="received"  fill={CHART_COLORS[2]} name="Received" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* table */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">All Locations Summary ({Object.keys(locationMap).length} locations)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Office Name</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Deliveries</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Estimated</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Issued</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Received</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {locationData.map((row) => (
                        <tr key={row.name} className="hover:bg-muted/10">
                          <td className="max-w-xs px-4 py-2.5 text-foreground">{row.name}</td>
                          <td className="px-4 py-2.5 text-right text-foreground">{row.deliveries}</td>
                          <td className="px-4 py-2.5 text-right text-foreground">{row.estimated.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-foreground">{row.issued.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-foreground">{row.received.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-foreground">{(row.issued - row.received).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                        <td className="px-4 py-2.5 text-foreground">TOTAL</td>
                        <td className="px-4 py-2.5 text-right text-foreground">—</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{locationData.reduce((s, r) => s + r.estimated, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{locationData.reduce((s, r) => s + r.issued, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{locationData.reduce((s, r) => s + r.received, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{locationData.reduce((s, r) => s + r.issued - r.received, 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── SEASONAL ESTIMATES ── */}
        {!loading && activeTab === 'seasonal' && (
          <div className="space-y-5">
            {/* Season summary cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {seasonalData.map((s) => {
                const season = SEASONS.find((x) => x.name === s.name)!;
                const Icon = season.icon;
                return (
                  <Card key={s.name} className="shadow-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground">{s.name}</span>
                        <Icon className="h-4 w-4" style={{ color: s.color }} />
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.estimate.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Avg issued (forecast)</p>
                      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        <p>Issued: <span className="font-medium text-foreground">{s.issued.toLocaleString()}</span></p>
                        <p>Received: <span className="font-medium text-foreground">{s.received.toLocaleString()}</span></p>
                        <p>Deliveries: <span className="font-medium text-foreground">{s.deliveries}</span></p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Seasonal chart */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Estimated vs Issued vs Received by Season</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={seasonalData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value, name) => [Number(value).toLocaleString(), name]} />
                      <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                      <Bar dataKey="estimate" fill={CHART_COLORS[4]} name="Estimate (avg)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="issued"    fill={CHART_COLORS[0]} name="Issued"    radius={[3, 3, 0, 0]} />
                      <Bar dataKey="received"  fill={CHART_COLORS[2]} name="Received"  radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Seasonal table */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Seasonal Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Season</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Months</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Deliveries</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Estimate (avg)</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Issued</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Received</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {seasonalData.map((s) => {
                        const season = SEASONS.find((x) => x.name === s.name)!;
                        const Icon = season.icon;
                        const monthLabels: Record<number, string> = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec'};
                        return (
                          <tr key={s.name} className="hover:bg-muted/10">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 shrink-0" style={{ color: s.color }} />
                                <span className="font-medium text-foreground">{s.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{season.months.map((m) => monthLabels[m]).join(', ')}</td>
                            <td className="px-4 py-3 text-right text-foreground">{s.deliveries}</td>
                            <td className="px-4 py-3 text-right text-foreground">{s.estimate.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">{s.issued.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">{s.received.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-foreground">{(s.issued - s.received).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                        <td className="px-4 py-2.5 text-foreground" colSpan={2}>ANNUAL TOTAL</td>
                        <td className="px-4 py-2.5 text-right text-foreground">—</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{seasonalData.reduce((s, r) => s + r.estimate, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{seasonalData.reduce((s, r) => s + r.issued, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{seasonalData.reduce((s, r) => s + r.received, 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{seasonalData.reduce((s, r) => s + r.issued - r.received, 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ReportsPage;

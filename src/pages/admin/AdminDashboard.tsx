import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeliveryStatusBadge } from '@/components/common/StatusBadge';
import { getAllDeliveries, getPendingDeliveries } from '@/services/api';
import type { Delivery, Profile } from '@/types/types';
import { format } from 'date-fns';
import {
  Truck, Clock, CheckCircle, XCircle, Package,
  TrendingUp, AlertTriangle, Eye, BarChart2
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [allDeliveries, setAllDeliveries] = useState<(Delivery & { vendor: Profile })[]>([]);
  const [pending, setPending] = useState<(Delivery & { vendor: Profile })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllDeliveries(200), getPendingDeliveries()]).then(
      ([{ data: all }, { data: pend }]) => {
        setAllDeliveries(all);
        setPending(pend);
        setLoading(false);
      }
    );
  }, []);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const stats = {
    total: allDeliveries.length,
    pendingReview: pending.length,
    approved: allDeliveries.filter((d) => ['approved', 'finalised'].includes(d.status)).length,
    rejected: allDeliveries.filter((d) => d.status === 'rejected_by_admin').length,
    totalIssued: 0,
    totalReceived: 0,
    monthConsumption: 0,
    yearConsumption: 0,
  };

  const summaryCards = [
    { label: 'Total Deliveries', value: stats.total, icon: Truck, color: 'text-primary', bg: 'bg-blue-50' },
    { label: 'Pending Review', value: stats.pendingReview, icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Total Issued', value: '—', icon: Package, color: 'text-primary', bg: 'bg-blue-50' },
    { label: 'Total Received', value: '—', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">{format(now, 'EEEE, dd MMMM yyyy')}</p>
          </div>
          <Button onClick={() => navigate('/admin/reports')} variant="outline" className="gap-2">
            <BarChart2 className="h-4 w-4" />
            View Reports
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map((s) => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="p-4">
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending Review */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Pending Review ({pending.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/deliveries')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />)}
              </div>
            ) : pending.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm text-muted-foreground">No deliveries pending review.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {format(new Date(d.delivery_date), 'dd MMM yyyy')}
                        </span>
                        <DeliveryStatusBadge status={d.status} />
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {d.vendor?.full_name || d.vendor_full_name}
                      </p>
                    </div>
                    <Button size="sm" className="shrink-0 gap-1.5" onClick={() => navigate(`/admin/delivery/${d.id}`)}>
                      <Eye className="h-3.5 w-3.5" />
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Deliveries */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4 text-primary" />
              Recent Deliveries
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/deliveries')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-semibold text-muted-foreground">Date</th>
                    <th className="pb-2 pr-4 font-semibold text-muted-foreground">Vendor</th>
                    <th className="pb-2 pr-4 font-semibold text-muted-foreground">Status</th>
                    <th className="pb-2 font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Loading...</td></tr>
                  ) : allDeliveries.slice(0, 8).map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5 pr-4 text-foreground">
                        {format(new Date(d.delivery_date), 'dd MMM yyyy')}
                      </td>
                      <td className="py-2.5 pr-4 text-foreground">
                        {d.vendor?.full_name || d.vendor_full_name}
                      </td>
                      <td className="py-2.5 pr-4">
                        <DeliveryStatusBadge status={d.status} />
                      </td>
                      <td className="py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 h-7 text-xs"
                          onClick={() => navigate(`/admin/delivery/${d.id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;

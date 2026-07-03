import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeliveryStatusBadge } from '@/components/common/StatusBadge';
import { getAllDeliveries } from '@/services/api';
import type { Delivery, Profile } from '@/types/types';
import { format } from 'date-fns';
import { Eye, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DeliveriesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<(Delivery & { vendor: Profile })[]>([]);
  const [filtered, setFiltered] = useState<(Delivery & { vendor: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    getAllDeliveries(200).then(({ data }) => {
      setDeliveries(data);
      setFiltered(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let result = deliveries;
    if (statusFilter !== 'all') result = result.filter((d) => d.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.vendor_full_name.toLowerCase().includes(q) ||
          d.delivery_date.includes(q) ||
          (d.vendor?.full_name || '').toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, statusFilter, deliveries]);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        <h1 className="text-2xl font-bold text-foreground">All Deliveries</h1>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by vendor or date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="submitted_to_admin">Submitted</SelectItem>
                  <SelectItem value="resubmitted_to_admin">Resubmitted</SelectItem>
                  <SelectItem value="rejected_by_admin">Rejected</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="finalised">Finalised</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Vendor</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Submitted</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Loading deliveries...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No deliveries found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-foreground">
                          {format(new Date(d.delivery_date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {d.vendor?.full_name || d.vendor_full_name}
                        </td>
                        <td className="px-4 py-3">
                          <DeliveryStatusBadge status={d.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {d.submitted_at
                            ? format(new Date(d.submitted_at), 'dd MMM yyyy')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => navigate(`/admin/delivery/${d.id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default DeliveriesListPage;

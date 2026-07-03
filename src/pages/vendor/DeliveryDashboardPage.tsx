import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DeliveryStatusBadge, ItemStatusBadge } from '@/components/common/StatusBadge';
import { getDelivery, getDeliveryItems } from '@/services/api';
import type { Delivery, DeliveryLocationItem } from '@/types/types';
import { format } from 'date-fns';
import {
  MapPin, Navigation, CheckCircle, Clock, XCircle, ArrowLeft,
  Send, AlertCircle
} from 'lucide-react';
import DeliveryMap from './DeliveryMap';

const DeliveryDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [items, setItems] = useState<DeliveryLocationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: del }, { data: itms }] = await Promise.all([
      getDelivery(id),
      getDeliveryItems(id),
    ]);
    setDelivery(del);
    setItems(itms);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <VendorLayout>
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </VendorLayout>
  );

  if (!delivery) return (
    <VendorLayout>
      <div className="p-6 text-center text-muted-foreground">Delivery not found.</div>
    </VendorLayout>
  );

  // Security: vendor can only see own delivery
  if (profile?.role === 'vendor' && delivery.vendor_id !== profile.id) {
    navigate('/vendor', { replace: true });
    return null;
  }

  const total = items.length;
  const completed = items.filter((i) => i.status === 'completed').length;
  const noIssue = items.filter((i) => i.status === 'no_issue_needed').length;
  const pending = items.filter((i) => i.status === 'pending').length;
  const done = completed + noIssue;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && pending === 0;
  const canSubmit = allDone && ['in_progress', 'rejected_by_admin', 'resubmitted_to_admin'].includes(delivery.status);
  const isReadOnly = !['in_progress', 'rejected_by_admin', 'resubmitted_to_admin'].includes(delivery.status);

  return (
    <VendorLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Back + header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/vendor')} className="shrink-0 mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                Delivery — {format(new Date(delivery.delivery_date), 'dd MMM yyyy')}
              </h1>
              <DeliveryStatusBadge status={delivery.status} />
            </div>
            <p className="text-sm text-muted-foreground">Vendor: {delivery.vendor_full_name}</p>
          </div>
        </div>

        {/* Rejection notice */}
        {delivery.status === 'rejected_by_admin' && delivery.admin_comments && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Rejected by Admin</p>
              <p className="mt-1 text-sm text-red-700">{delivery.admin_comments}</p>
              <p className="mt-2 text-sm text-red-600">Please review and correct issues, then resubmit.</p>
            </div>
          </div>
        )}

        {/* Progress summary */}
        <Card className="shadow-card">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Total', value: total, icon: MapPin, color: 'text-primary' },
                { label: 'Completed', value: completed, icon: CheckCircle, color: 'text-green-600' },
                { label: 'No Issue', value: noIssue, icon: XCircle, color: 'text-gray-500' },
                { label: 'Pending', value: pending, icon: Clock, color: 'text-yellow-600' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <s.icon className={`h-5 w-5 shrink-0 ${s.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{pct}% complete</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <DeliveryMap items={items} />

        {/* Locations list */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery Locations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Route {item.route_number}
                      </span>
                      <ItemStatusBadge status={item.status} />
                    </div>
                    <p className="font-medium text-foreground">{item.office_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Bldg {item.building_number} · {item.sup_number} · Est. {item.estimated_bottles} bottles
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {item.latitude && item.longitude && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`,
                            '_blank'
                          )
                        }
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Maps
                      </Button>
                    )}
                    {!isReadOnly && (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => navigate(`/vendor/delivery/${delivery.id}/location/${item.id}`)}
                      >
                        Open
                      </Button>
                    )}
                    {isReadOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => navigate(`/vendor/delivery/${delivery.id}/location/${item.id}`)}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Submit button */}
        {canSubmit && (
          <div className="pb-4">
            <Button
              className="h-12 w-full gap-2 text-base"
              onClick={() => navigate(`/vendor/delivery/${delivery.id}/confirm`)}
            >
              <Send className="h-5 w-5" />
              Submit Delivery to Admin
            </Button>
          </div>
        )}
        {!canSubmit && !isReadOnly && pending > 0 && (
          <p className="text-center text-sm text-muted-foreground pb-4">
            Complete all {pending} pending location{pending !== 1 ? 's' : ''} to enable submission.
          </p>
        )}
      </div>
    </VendorLayout>
  );
};

export default DeliveryDashboardPage;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeliveryStatusBadge } from '@/components/common/StatusBadge';
import { getVendorDeliveries, getDeliveryItems } from '@/services/api';
import type { Delivery } from '@/types/types';
import { format } from 'date-fns';
import {
  Plus,
  Truck,
  Package,
  CheckCircle,
  Clock,
  FileDown,
  AlertCircle,
} from 'lucide-react';
import { generateWaybillPdf } from '@/utils/generateWaybillPdf';
import { toast } from 'sonner';

const VendorDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      getVendorDeliveries(profile.id).then(({ data }) => {
        setDeliveries(data);
        setLoading(false);
      });
    }
  }, [profile?.id]);

  const stats = {
    total: deliveries.length,
    inProgress: deliveries.filter((d) => d.status === 'in_progress').length,
    submitted: deliveries.filter((d) => ['submitted_to_admin', 'resubmitted_to_admin'].includes(d.status)).length,
    approved: deliveries.filter((d) => ['approved', 'finalised'].includes(d.status)).length,
  };

  return (
    <VendorLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vendor Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name || 'Vendor'}
            </p>
          </div>
          <Button onClick={() => navigate('/vendor/new-delivery')} className="gap-2">
            <Plus className="h-4 w-4" />
            Start New Delivery
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Total Deliveries', value: stats.total, icon: Truck, color: 'text-primary' },
            { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-yellow-600' },
            { label: 'Pending Review', value: stats.submitted, icon: AlertCircle, color: 'text-blue-600' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600' },
          ].map((stat) => (
            <Card key={stat.label} className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-5 w-5 shrink-0 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Delivery History */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Delivery History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Truck className="h-12 w-12 text-muted-foreground/40" />
                <p className="mt-4 font-medium text-muted-foreground">No deliveries yet</p>
                <p className="text-sm text-muted-foreground">Start a new delivery to get going</p>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => navigate('/vendor/new-delivery')}
                >
                  <Plus className="h-4 w-4" />
                  Start New Delivery
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveries.map((d) => (
                  <DeliveryCard
                    key={d.id}
                    delivery={d}
                    onClick={() => navigate(`/vendor/delivery/${d.id}`)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </VendorLayout>
  );
};

const DeliveryCard: React.FC<{
  delivery: Delivery;
  onClick: () => void;
}> = ({ delivery, onClick }) => {
  const [downloading, setDownloading] = useState(false);

  // Show the download button for any finalised delivery
  const canDownload = ['approved', 'finalised'].includes(delivery.status);

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      const { data: items } = await getDeliveryItems(delivery.id);
      await generateWaybillPdf(delivery, items ?? []);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-hover cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">
              {format(new Date(delivery.delivery_date), 'dd MMM yyyy')}
            </span>
            <DeliveryStatusBadge status={delivery.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Vendor: {delivery.vendor_full_name}
          </p>
        </div>
        <div className="shrink-0">
          {canDownload ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Generating…
                </span>
              ) : (
                <>
                  <FileDown className="h-3.5 w-3.5" />
                  Download PDF
                </>
              )}
            </Button>
          ) : (
            <p className="text-xs italic text-muted-foreground">PDF available after admin approval.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;

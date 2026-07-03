import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDelivery, createDeliveryItems, getActiveLocations, addAuditLog } from '@/services/api';
import { toast } from 'sonner';
import { CalendarIcon, ArrowRight, MapPin } from 'lucide-react';
import { format } from 'date-fns';

const NewDeliveryPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [vendorFullName, setVendorFullName] = useState(profile?.full_name || '');
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getActiveLocations().then(({ data }) => setLocationCount(data.length));
  }, []);

  useEffect(() => {
    if (profile?.full_name) setVendorFullName(profile.full_name);
  }, [profile]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryDate || !vendorFullName.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!profile?.id) return;

    setLoading(true);

    const { data: delivery, error: delErr } = await createDelivery({
      delivery_date: deliveryDate,
      vendor_id: profile.id,
      vendor_full_name: vendorFullName.trim(),
      status: 'in_progress',
    });

    if (delErr || !delivery) {
      toast.error('Failed to create delivery', { description: delErr?.message });
      setLoading(false);
      return;
    }

    const { data: locations } = await getActiveLocations();
    const items = locations.map((loc) => ({
      delivery_id: delivery.id,
      location_id: loc.id,
      route_number: loc.route_number,
      building_number: loc.building_number,
      office_name: loc.office_name,
      sup_number: loc.sup_number,
      estimated_bottles: loc.estimated_bottles,
      status: 'pending' as const,
      no_issue_needed: false,
      issued_quantity: 0,
      received_quantity: 0,
    }));

    const { error: itemErr } = await createDeliveryItems(items);
    if (itemErr) {
      toast.error('Failed to create delivery items', { description: itemErr.message });
      setLoading(false);
      return;
    }

    await addAuditLog({
      user_id: profile.id,
      action: 'delivery_created',
      entity_type: 'delivery',
      entity_id: delivery.id,
      details: { delivery_date: deliveryDate, vendor_full_name: vendorFullName },
    });

    toast.success('Delivery started successfully');
    navigate(`/vendor/delivery/${delivery.id}`);
  };

  return (
    <VendorLayout>
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-lg">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Start New Delivery</h1>
            <p className="text-muted-foreground">Create a new water bottle delivery session</p>
          </div>

          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Delivery Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStart} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">
                    Delivery Date <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="deliveryDate"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      required
                      className="h-11 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendorName">
                    Vendor Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="vendorName"
                    placeholder="Enter your full name"
                    value={vendorFullName}
                    onChange={(e) => setVendorFullName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                {locationCount !== null && (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-4">
                    <MapPin className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {locationCount} active location{locationCount !== 1 ? 's' : ''} will be assigned
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Complete all locations before submitting to admin
                      </p>
                    </div>
                  </div>
                )}

                {locationCount === 0 && (
                  <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                    No active locations available. Contact admin to add locations before starting a delivery.
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full gap-2"
                  disabled={loading || locationCount === 0}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Creating delivery...
                    </span>
                  ) : (
                    <>
                      Start Delivery
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </VendorLayout>
  );
};

export default NewDeliveryPage;

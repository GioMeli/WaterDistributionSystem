import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSigCanvas, type NativeSigCanvasHandle } from '@/components/common/SignaturePad';
import { updateDelivery, uploadFile, addAuditLog } from '@/services/api';import { toast } from 'sonner';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { getSettings } from '@/services/api';

const ConfirmSubmitPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const sigRef = useRef<NativeSigCanvasHandle>(null);

  const [vendorName, setVendorName] = useState(profile?.full_name || '');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmSig = useCallback(() => {
    if (sigRef.current?.isEmpty()) {
      toast.error('Please draw your signature');
      return;
    }
    setSignatureData(sigRef.current?.getTrimmedCanvas().toDataURL('image/png') ?? null);
    toast.success('Signature confirmed');
  }, []);

  const handleSubmit = async () => {
    if (!id || !profile) return;
    if (!vendorName.trim()) {
      toast.error('Vendor full name is required');
      return;
    }
    if (!signatureData) {
      toast.error('Vendor signature is required');
      return;
    }

    setSubmitting(true);

    // Upload vendor signature
    const blob = await fetch(signatureData).then((r) => r.blob());
    const path = `signatures/${id}/vendor_signature.png`;
    const sigUrl = await uploadFile('signatures', path, blob, 'image/png');

    const { error } = await updateDelivery(id, {
      vendor_full_name: vendorName.trim(),
      vendor_signature_url: sigUrl,
      status: 'submitted_to_admin',
      submitted_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Submission failed', { description: error.message });
      setSubmitting(false);
      return;
    }

    await addAuditLog({
      user_id: profile.id,
      action: 'delivery_submitted',
      entity_type: 'delivery',
      entity_id: id,
      details: { vendor_name: vendorName },
    });

    try {
      const { data: settings } = await getSettings();
      const settingsMap: Record<string, string> = {};
      settings.forEach((s) => {
        settingsMap[s.key] = s.value || '';
      });

      const adminEmail =
        settingsMap.notification_email ||
        settingsMap.admin_email ||
        'georgios.meli@un.org';

      await supabase.functions.invoke('send-email', {
        body: {
          to: adminEmail,
          subject: 'New delivery submitted for review',
          body: `
            <p>A new water delivery has been submitted by <strong>${vendorName.trim()}</strong>.</p>
            <p>Please login to the Admin Portal to review and approve the delivery.</p>
            <p><strong>Delivery ID:</strong> ${id}</p>
          `,
        },
      });
    } catch (emailError) {
      console.error('Admin notification email failed:', emailError);
    }

    toast.success('Delivery submitted to Admin successfully');
    navigate('/vendor');
  };

  return (
    <VendorLayout>
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-lg space-y-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/vendor/delivery/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Submit to Admin</h1>
              <p className="text-sm text-muted-foreground">
                Confirm your identity and sign before submitting
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            <p className="text-sm text-blue-800">
              Once submitted, you cannot edit the delivery unless the admin rejects it.
              Please verify all location data is correct before proceeding.
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vendor Confirmation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="vendorName">
                  Vendor Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vendorName"
                  placeholder="Your full legal name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Vendor Signature <span className="text-destructive">*</span>
                </Label>
                {signatureData ? (
                  <div className="space-y-2">
                    <div className="rounded border border-border bg-white p-2">
                      <img src={signatureData} alt="Your signature" className="h-20 max-w-full object-contain" />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSignatureData(null)}>
                      Re-draw Signature
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded border-2 border-dashed border-border bg-white">
                      <NativeSigCanvas
                        ref={sigRef}
                        penColor="#1E293B"
                        canvasProps={{ className: 'w-full rounded', style: { height: '140px' } }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => sigRef.current?.clear()}>
                        Clear
                      </Button>
                      <Button type="button" size="sm" onClick={handleConfirmSig}>
                        Confirm Signature
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="h-12 w-full gap-2 text-base"
                onClick={handleSubmit}
                disabled={submitting || !signatureData || !vendorName.trim()}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Submitting...
                  </span>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Submit to Admin
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </VendorLayout>
  );
};

export default ConfirmSubmitPage;

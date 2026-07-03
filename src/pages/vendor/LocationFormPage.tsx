import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VendorLayout } from '@/components/layouts/VendorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { NativeSigCanvas, type NativeSigCanvasHandle } from '@/components/common/SignaturePad';
import { getDelivery, getDeliveryItems, updateDeliveryItem, uploadFile, addAuditLog } from '@/services/api';import type { Delivery, DeliveryLocationItem } from '@/types/types';
import { toast } from 'sonner';
import { ArrowLeft, Save, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const LocationFormPage: React.FC = () => {
  const { id, itemId } = useParams<{ id: string; itemId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const sigRef = useRef<NativeSigCanvasHandle>(null);

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [item, setItem] = useState<DeliveryLocationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [noIssue, setNoIssue] = useState(false);
  const [issuedQty, setIssuedQty] = useState('');
  const [receivedQty, setReceivedQty] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [notes, setNotes] = useState('');
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !itemId) return;
    const [{ data: del }, { data: itms }] = await Promise.all([
      getDelivery(id),
      getDeliveryItems(id),
    ]);
    setDelivery(del);
    const found = itms.find((i) => i.id === itemId) ?? null;
    setItem(found);
    if (found) {
      setNoIssue(found.no_issue_needed);
      setIssuedQty(found.issued_quantity > 0 ? String(found.issued_quantity) : '');
      setReceivedQty(found.received_quantity > 0 ? String(found.received_quantity) : '');
      setOfficerName(found.officer_name || '');
      setNotes(found.notes || '');
      setSignatureUrl(found.officer_signature_url);
    }
    setLoading(false);
  }, [id, itemId]);

  useEffect(() => { load(); }, [load]);

  const isReadOnly = delivery
    ? !['in_progress', 'rejected_by_admin', 'resubmitted_to_admin'].includes(delivery.status)
    : true;

  const handleNoIssueChange = (checked: boolean) => {
    setNoIssue(checked);
    if (checked) {
      setIssuedQty('0');
      setReceivedQty('0');
      setOfficerName('No Issue Required');
      setSignatureUrl(null);
    } else {
      setIssuedQty('');
      setReceivedQty('');
      setOfficerName('');
    }
  };

  const handleSaveSignature = () => {
    if (sigRef.current?.isEmpty()) {
      toast.error('Please draw a signature first');
      return;
    }
    const dataUrl = sigRef.current?.getTrimmedCanvas().toDataURL('image/png') ?? '';
    setSignatureUrl(dataUrl);
    toast.success('Signature saved');
  };

  const handleSave = async () => {
    if (!item || !delivery || !profile) return;
    if (isReadOnly) return;

    if (!noIssue) {
      if (!issuedQty || Number(issuedQty) < 0) {
        toast.error('Issued quantity is required and cannot be negative');
        return;
      }
      if (!receivedQty || Number(receivedQty) < 0) {
        toast.error('Received quantity is required and cannot be negative');
        return;
      }
      if (!officerName.trim()) {
        toast.error('Officer name is required');
        return;
      }
      if (!signatureUrl) {
        toast.error('Officer signature is required');
        return;
      }
    }

    setSaving(true);

    let finalSigUrl = signatureUrl;
    // Upload signature if it's a data URL (base64)
    if (signatureUrl && signatureUrl.startsWith('data:')) {
      const blob = await fetch(signatureUrl).then((r) => r.blob());
      const path = `signatures/${delivery.id}/${item.id}_officer.png`;
      finalSigUrl = await uploadFile('signatures', path, blob, 'image/png');
    }

    const updates: Partial<DeliveryLocationItem> = {
      no_issue_needed: noIssue,
      issued_quantity: noIssue ? 0 : Number(issuedQty),
      received_quantity: noIssue ? 0 : Number(receivedQty),
      officer_name: noIssue ? 'No Issue Required' : officerName.trim(),
      officer_signature_url: noIssue ? null : finalSigUrl,
      notes: notes.trim() || null,
      status: noIssue ? 'no_issue_needed' : 'completed',
      completed_at: new Date().toISOString(),
    };

    const { error } = await updateDeliveryItem(item.id, updates);
    if (error) {
      toast.error('Failed to save location', { description: error.message });
      setSaving(false);
      return;
    }

    await addAuditLog({
      user_id: profile.id,
      action: 'location_completed',
      entity_type: 'delivery_location_item',
      entity_id: item.id,
      details: { office_name: item.office_name, status: updates.status },
    });

    toast.success('Location saved successfully');
    navigate(`/vendor/delivery/${delivery.id}`);
  };

  if (loading) return (
    <VendorLayout>
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </VendorLayout>
  );

  if (!item) return (
    <VendorLayout>
      <div className="p-6 text-center text-muted-foreground">Location not found.</div>
    </VendorLayout>
  );

  return (
    <VendorLayout>
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Back */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/vendor/delivery/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{item.office_name}</h1>
              <p className="text-sm text-muted-foreground">
                Route {item.route_number} · Building {item.building_number}
              </p>
            </div>
          </div>

          {/* Location info */}
          <Card className="shadow-card border-primary/20 bg-muted/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                {[
                  { label: 'Route No.', value: item.route_number },
                  { label: 'Building', value: item.building_number },
                  { label: 'SUP No.', value: item.sup_number },
                  { label: 'Est. Bottles', value: item.estimated_bottles },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</p>
                    <p className="font-medium text-foreground">{f.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {isReadOnly && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              This delivery has been submitted. Location details are read-only.
            </div>
          )}

          {/* Delivery form */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Delivery Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* No Issue checkbox */}
              <div className="flex items-start gap-3 rounded-lg border border-border p-4">
                <Checkbox
                  id="noIssue"
                  checked={noIssue}
                  onCheckedChange={(c) => handleNoIssueChange(c as boolean)}
                  disabled={isReadOnly}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="noIssue" className="font-semibold cursor-pointer">
                    No Issue Needed
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No water bottles needed at this location. All quantities will be set to 0.
                  </p>
                </div>
              </div>

              {/* Quantity fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="issued">
                    Issued Quantity {!noIssue && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="issued"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={noIssue ? '0' : issuedQty}
                    onChange={(e) => setIssuedQty(e.target.value)}
                    disabled={isReadOnly || noIssue}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="received">
                    Received Quantity {!noIssue && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="received"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={noIssue ? '0' : receivedQty}
                    onChange={(e) => setReceivedQty(e.target.value)}
                    disabled={isReadOnly || noIssue}
                    className="h-11"
                  />
                </div>
              </div>

              {/* Officer Name */}
              <div className="space-y-2">
                <Label htmlFor="officerName">
                  Officer Name {!noIssue && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="officerName"
                  placeholder="Full name of receiving officer"
                  value={noIssue ? 'No Issue Required' : officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  disabled={isReadOnly || noIssue}
                  className="h-11"
                />
              </div>

              {/* Officer Signature */}
              {!noIssue && (
                <div className="space-y-2">
                  <Label>
                    Officer Signature <span className="text-destructive">*</span>
                  </Label>
                  {signatureUrl && !signatureUrl.startsWith('data:') ? (
                    <div className="space-y-2">
                      <div className="rounded border border-border bg-white p-2">
                        <img src={signatureUrl} alt="Officer signature" className="h-20 max-w-full object-contain" />
                      </div>
                      {!isReadOnly && (
                        <Button variant="outline" size="sm" onClick={() => setSignatureUrl(null)}>
                          Re-draw Signature
                        </Button>
                      )}
                    </div>
                  ) : signatureUrl && signatureUrl.startsWith('data:') ? (
                    <div className="space-y-2">
                      <div className="rounded border border-border bg-white p-2">
                        <img src={signatureUrl} alt="Officer signature" className="h-20 max-w-full object-contain" />
                      </div>
                      {!isReadOnly && (
                        <Button variant="outline" size="sm" onClick={() => setSignatureUrl(null)}>
                          Re-draw Signature
                        </Button>
                      )}
                    </div>
                  ) : !isReadOnly ? (
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
                        <Button type="button" size="sm" onClick={handleSaveSignature}>
                          Confirm Signature
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No signature captured.</p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isReadOnly}
                  rows={3}
                  className="px-3"
                />
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          {!isReadOnly && (
            <div className="flex gap-3 pb-6">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => navigate(`/vendor/delivery/${id}`)}
              >
                Back to Dashboard
              </Button>
              <Button className="flex-1 h-11 gap-2" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Saving...
                  </span>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Location
                  </>
                )}
              </Button>
            </div>
          )}
          {isReadOnly && (
            <div className="pb-6">
              <Button variant="outline" className="w-full h-11" onClick={() => navigate(`/vendor/delivery/${id}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
};

export default LocationFormPage;

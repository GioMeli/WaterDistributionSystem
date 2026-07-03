import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DeliveryStatusBadge, ItemStatusBadge } from '@/components/common/StatusBadge';
import { getDelivery, getDeliveryItems, updateDelivery, uploadFile, addAuditLog } from '@/services/api';
import type { Delivery, DeliveryLocationItem, Profile } from '@/types/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { NativeSigCanvas, type NativeSigCanvasHandle } from '@/components/common/SignaturePad';
import { ArrowLeft, CheckCircle, XCircle, FileDown, User, Calendar,
  Package, AlertTriangle, ThumbsUp,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { generateWaybillPdf } from '@/utils/generateWaybillPdf';

const DeliveryReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const sigRef = useRef<NativeSigCanvasHandle>(null);

  const [delivery, setDelivery] = useState<(Delivery & { vendor: Profile }) | null>(null);
  const [items, setItems] = useState<DeliveryLocationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Approve dialog
  const [approveOpen, setApproveOpen] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminComments, setAdminComments] = useState('');
  const [adminSigData, setAdminSigData] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: del }, { data: itms }] = await Promise.all([
      getDelivery(id),
      getDeliveryItems(id),
    ]);
    setDelivery(del);
    setItems(itms);
    if (profile?.full_name) setAdminName(profile.full_name);
    setLoading(false);
  }, [id, profile]);

  useEffect(() => { load(); }, [load]);

  const totalIssued = items.reduce((s, i) => s + i.issued_quantity, 0);
  const totalReceived = items.reduce((s, i) => s + i.received_quantity, 0);
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const noIssueCount = items.filter((i) => i.status === 'no_issue_needed').length;

  const handleReject = async () => {
    if (!id || !profile || !rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setRejecting(true);
    const { error } = await updateDelivery(id, {
      status: 'rejected_by_admin',
      admin_comments: rejectReason.trim(),
      admin_id: profile.id,
      admin_full_name: profile.full_name,
    });
    if (error) {
      toast.error('Failed to reject delivery');
      setRejecting(false);
      return;
    }
    await addAuditLog({
      user_id: profile.id,
      action: 'delivery_rejected',
      entity_type: 'delivery',
      entity_id: id,
      details: { reason: rejectReason },
    });
    toast.success('Delivery rejected and returned to vendor');
    setRejectOpen(false);
    navigate('/admin/deliveries');
  };

  const handleApprove = async () => {
    if (!id || !profile) return;
    if (!adminName.trim()) { toast.error('Admin name is required'); return; }
    if (!adminSigData) { toast.error('Admin signature is required'); return; }

    setApproving(true);

    // Upload admin signature
    const blob = await fetch(adminSigData).then((r) => r.blob());
    const path = `signatures/${id}/admin_signature.png`;
    const sigUrl = await uploadFile('signatures', path, blob, 'image/png');

    const updatedDelivery = {
      ...delivery!,
      admin_id: profile.id,
      admin_full_name: adminName.trim(),
      admin_signature_url: sigUrl ?? undefined,
      admin_comments: adminComments.trim() || null,
      approved_at: new Date().toISOString(),
      finalised_at: new Date().toISOString(),
    };

    const { error } = await updateDelivery(id, {
      status: 'finalised',
      admin_id: profile.id,
      admin_full_name: adminName.trim(),
      admin_signature_url: sigUrl,
      admin_comments: adminComments.trim() || null,
      approved_at: new Date().toISOString(),
      finalised_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Approval failed', { description: error.message });
      setApproving(false);
      return;
    }

    await addAuditLog({
      user_id: profile.id,
      action: 'delivery_approved',
      entity_type: 'delivery',
      entity_id: id,
      details: { admin_name: adminName },
    });

    toast.success('Delivery approved and finalised!');
    setApproveOpen(false);

    // Immediately trigger PDF download with fresh signature data
    try {
      await generateWaybillPdf(updatedDelivery as Delivery & { vendor?: { full_name: string; email: string } }, items);
    } catch (e) {
      console.warn('PDF download failed after approval:', e);
    }

    navigate('/admin/deliveries');
  };

  const handleDownloadPdf = async () => {
    if (!delivery) return;
    setDownloading(true);
    try {
      await generateWaybillPdf(delivery, items);
    } catch (e) {
      toast.error('Failed to generate PDF');
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <AdminLayout>
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </AdminLayout>
  );

  if (!delivery) return (
    <AdminLayout>
      <div className="p-6 text-center text-muted-foreground">Delivery not found.</div>
    </AdminLayout>
  );

  const canReview = ['submitted_to_admin', 'resubmitted_to_admin'].includes(delivery.status);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/deliveries')} className="mt-0.5 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                Delivery Review
              </h1>
              <DeliveryStatusBadge status={delivery.status} />
            </div>
          </div>
        </div>

        {/* Delivery header card */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { icon: Calendar, label: 'Delivery Date', value: format(new Date(delivery.delivery_date), 'dd MMM yyyy') },
                { icon: User, label: 'Vendor', value: delivery.vendor?.full_name || delivery.vendor_full_name },
                { icon: Package, label: 'Total Issued', value: totalIssued },
                { icon: CheckCircle, label: 'Total Received', value: totalReceived },
              ].map((f) => (
                <div key={f.label} className="flex items-start gap-2">
                  <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="font-semibold text-foreground">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
              <span>Completed: <strong className="text-foreground">{completedCount}</strong></span>
              <span>No Issue: <strong className="text-foreground">{noIssueCount}</strong></span>
              {delivery.submitted_at && (
                <span>Submitted: <strong className="text-foreground">{format(new Date(delivery.submitted_at), 'dd MMM yyyy HH:mm')}</strong></span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vendor signature */}
        {delivery.vendor_signature_url && (
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Vendor Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-sm font-medium text-foreground mb-2">{delivery.vendor_full_name}</p>
              <div className="inline-block rounded border border-border bg-white p-2">
                <img src={delivery.vendor_signature_url} alt="Vendor signature" className="h-16 max-w-xs object-contain" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin comments */}
        {delivery.admin_comments && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800">Admin Comments</p>
              <p className="mt-1 text-sm text-yellow-700">{delivery.admin_comments}</p>
            </div>
          </div>
        )}

        {/* Locations table */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery Locations ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Route', 'Building', 'Office', 'SUP No.', 'Est.', 'Issued', 'Received', 'Officer', 'Status', 'Signature', 'Notes'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/10">
                      <td className="px-3 py-2.5 text-foreground">{item.route_number}</td>
                      <td className="px-3 py-2.5 text-foreground">{item.building_number}</td>
                      <td className="max-w-xs px-3 py-2.5 text-foreground">{item.office_name}</td>
                      <td className="px-3 py-2.5 text-foreground">{item.sup_number}</td>
                      <td className="px-3 py-2.5 text-foreground">{item.estimated_bottles}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{item.issued_quantity}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{item.received_quantity}</td>
                      <td className="px-3 py-2.5 text-foreground">{item.officer_name || '—'}</td>
                      <td className="px-3 py-2.5">
                        <ItemStatusBadge status={item.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        {item.officer_signature_url ? (
                          <img
                            src={item.officer_signature_url}
                            alt="Sig"
                            className="h-10 w-20 rounded border border-border bg-white object-contain p-0.5"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-xs px-3 py-2.5 text-muted-foreground">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {canReview && (
          <div className="flex flex-col gap-3 pb-6 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1 h-11 gap-2 border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setRejectOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              Reject Delivery
            </Button>
            <Button
              className="flex-1 h-11 gap-2"
              onClick={() => setApproveOpen(true)}
            >
              <ThumbsUp className="h-4 w-4" />
              Approve & Generate PDF
            </Button>
          </div>
        )}

        {(delivery.final_signed_pdf_url || delivery.status === 'finalised') && (
          <div className="pb-4">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Generating…
                </span>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Download Final PDF
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The delivery will be returned to the vendor with your rejection reason.
            </p>
            <div className="space-y-2">
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Explain why this delivery is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="px-3"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
            >
              {rejecting ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve & Generate Final PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Admin Full Name <span className="text-destructive">*</span></Label>
              <Input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Your full name"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Admin Comments (Optional)</Label>
              <Textarea
                value={adminComments}
                onChange={(e) => setAdminComments(e.target.value)}
                placeholder="Any comments..."
                rows={2}
                className="px-3"
              />
            </div>
            <div className="space-y-2">
              <Label>Admin Signature <span className="text-destructive">*</span></Label>
              {adminSigData ? (
                <div className="space-y-2">
                  <div className="rounded border border-border bg-white p-2">
                    <img src={adminSigData} alt="Admin signature" className="h-16 max-w-full object-contain" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAdminSigData(null)}>Re-draw</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded border-2 border-dashed border-border bg-white">
                    <NativeSigCanvas
                      ref={sigRef}
                      penColor="#1E293B"
                      canvasProps={{ className: 'w-full rounded', style: { height: '120px' } }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => sigRef.current?.clear()}>Clear</Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (sigRef.current?.isEmpty()) { toast.error('Please draw signature'); return; }
                        setAdminSigData(sigRef.current?.getTrimmedCanvas().toDataURL('image/png') ?? null);
                      }}
                    >
                      Confirm Signature
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button
              onClick={handleApprove}
              disabled={approving || !adminName.trim() || !adminSigData}
            >
              {approving ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Processing...
                </span>
              ) : 'Approve & Generate PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default DeliveryReviewPage;

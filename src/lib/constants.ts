import type { DeliveryStatus, ItemStatus } from '@/types/types';

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  submitted_to_admin: 'Submitted to Admin',
  rejected_by_admin: 'Rejected',
  resubmitted_to_admin: 'Resubmitted',
  approved: 'Approved',
  finalised: 'Finalised',
};

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-yellow-100 text-yellow-800',
  submitted_to_admin: 'bg-blue-100 text-blue-800',
  rejected_by_admin: 'bg-red-100 text-red-800',
  resubmitted_to_admin: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  finalised: 'bg-emerald-100 text-emerald-800',
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  no_issue_needed: 'No Issue Needed',
};

export const ITEM_STATUS_COLORS: Record<ItemStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  no_issue_needed: 'bg-gray-100 text-gray-600',
};

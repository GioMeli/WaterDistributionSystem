import React from 'react';
import { cn } from '@/lib/utils';
import type { DeliveryStatus, ItemStatus } from '@/types/types';
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_COLORS,
  ITEM_STATUS_LABELS,
  ITEM_STATUS_COLORS,
} from '@/lib/constants';

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus;
  className?: string;
}

export const DeliveryStatusBadge: React.FC<DeliveryStatusBadgeProps> = ({ status, className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      DELIVERY_STATUS_COLORS[status],
      className
    )}
  >
    {DELIVERY_STATUS_LABELS[status]}
  </span>
);

interface ItemStatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

export const ItemStatusBadge: React.FC<ItemStatusBadgeProps> = ({ status, className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      ITEM_STATUS_COLORS[status],
      className
    )}
  >
    {ITEM_STATUS_LABELS[status]}
  </span>
);

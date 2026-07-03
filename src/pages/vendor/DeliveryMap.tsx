import React, { useMemo } from 'react';
import type { DeliveryLocationItem } from '@/types/types';

const GMAPS_KEY = 'AIzaSyB_LJOYJL-84SMuxNB7LtRGhxEQLjswvy0';

// Marker color mapping for Google Static Maps API
const STATUS_MARKER: Record<string, string> = {
  pending: 'red',
  completed: 'green',
  no_issue_needed: 'gray',
};

interface DeliveryMapProps {
  items: DeliveryLocationItem[];
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ items }) => {
  const geoItems = useMemo(
    () => items.filter((i) => i.latitude != null && i.longitude != null),
    [items]
  );

  const staticMapUrl = useMemo(() => {
    if (geoItems.length === 0) return null;

    const centerLat = geoItems.reduce((s, i) => s + (i.latitude ?? 0), 0) / geoItems.length;
    const centerLng = geoItems.reduce((s, i) => s + (i.longitude ?? 0), 0) / geoItems.length;

    // Build marker params grouped by color
    const markerParams = geoItems
      .map((item) => {
        const color = STATUS_MARKER[item.status] ?? 'blue';
        return `markers=color:${color}%7C${item.latitude},${item.longitude}`;
      })
      .join('&');

    return (
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${centerLat},${centerLng}` +
      `&zoom=14` +
      `&size=640x320` +
      `&maptype=roadmap` +
      `&${markerParams}` +
      `&key=${GMAPS_KEY}`
    );
  }, [geoItems]);

  if (geoItems.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
        No map coordinates available for these locations.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <img
        src={staticMapUrl!}
        alt="Delivery locations map"
        className="w-full object-cover"
        style={{ height: '320px' }}
      />
      <div className="flex items-center gap-4 border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> No Issue
        </span>
      </div>
    </div>
  );
};

export default DeliveryMap;

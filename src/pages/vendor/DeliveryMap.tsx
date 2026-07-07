import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

type Props = {
  items: any[];
};

const getColor = (status: string) => {
  if (status === 'completed') return '#22c55e';
  if (status === 'no_issue') return '#9ca3af';
  return '#ef4444';
};

const createRouteIcon = (routeNumber: string | number, status: string) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        background:${getColor(status)};
        color:white;
        width:30px;
        height:30px;
        border-radius:9999px;
        border:2px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:700;
      ">
        ${routeNumber ?? ''}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });

const DeliveryMap: React.FC<Props> = ({ items }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  const validItems = items.filter(
    (i) =>
      i.latitude !== null &&
      i.longitude !== null &&
      !Number.isNaN(Number(i.latitude)) &&
      !Number.isNaN(Number(i.longitude))
  );

  useEffect(() => {
    if (!mapRef.current || validItems.length === 0) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const centerLat =
      validItems.reduce((sum, i) => sum + Number(i.latitude), 0) / validItems.length;

    const centerLng =
      validItems.reduce((sum, i) => sum + Number(i.longitude), 0) / validItems.length;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      scrollWheelZoom: true,
    });

    leafletMapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    validItems.forEach((item) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);

      bounds.extend([lat, lng]);

      L.marker([lat, lng], {
        icon: createRouteIcon(item.route_number, item.status),
      })
        .addTo(map)
        .bindPopup(`
          <strong>Route ${item.route_number ?? '-'}</strong><br/>
          ${item.office_name || item.location_name || 'Location'}<br/>
          Status: ${item.status}
        `);
    });

    if (validItems.length > 1) {
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 17,
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [items]);

  if (validItems.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        No map available. Add latitude and longitude to the delivery locations.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      <div
          ref={mapRef}
          className="
              aspect-square
              lg:aspect-auto
              lg:h-[380px]
              w-full
              rounded-lg
          "
      />

      <div className="flex gap-4 border-t bg-white px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-green-500" />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full bg-gray-400" />
          No Issue
        </span>
      </div>
    </div>
  );
};

export default DeliveryMap;

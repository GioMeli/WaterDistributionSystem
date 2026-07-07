import React from 'react';

type Props = {
  items: any[];
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

const project = (lat: number, lng: number, zoom: number) => {
  const sin = Math.sin(toRad(lat));
  const scale = 256 * Math.pow(2, zoom);

  return {
    x: ((lng + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) *
      scale,
  };
};

const getColor = (status: string) => {
  if (status === 'completed') return '#22c55e';
  if (status === 'no_issue') return '#9ca3af';
  return '#ef4444';
};

const DeliveryMap: React.FC<Props> = ({ items }) => {
  const validItems = items.filter(
    (i) =>
      i.latitude !== null &&
      i.longitude !== null &&
      !Number.isNaN(Number(i.latitude)) &&
      !Number.isNaN(Number(i.longitude))
  );

  if (validItems.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        No map available. Add latitude and longitude to the delivery locations.
      </div>
    );
  }

  const zoom = 13;
  const width = 1000;
  const height = 340;

  const centerLat =
    validItems.reduce((sum, i) => sum + Number(i.latitude), 0) /
    validItems.length;

  const centerLng =
    validItems.reduce((sum, i) => sum + Number(i.longitude), 0) /
    validItems.length;

  const center = project(centerLat, centerLng, zoom);

  const centerTileX = Math.floor(center.x / 256);
  const centerTileY = Math.floor(center.y / 256);

  const tiles = [];

  for (let x = -2; x <= 2; x++) {
    for (let y = -1; y <= 1; y++) {
      const tileX = centerTileX + x;
      const tileY = centerTileY + y;

      tiles.push({
        key: `${tileX}-${tileY}`,
        url: `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`,
        left: tileX * 256 - center.x + width / 2,
        top: tileY * 256 - center.y + height / 2,
      });
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      <div className="relative h-[340px] w-full">
        <div
          className="absolute left-1/2 top-0 h-[340px]"
          style={{
            width,
            transform: 'translateX(-50%)',
          }}
        >
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              className="absolute h-64 w-64 select-none"
              style={{
                left: tile.left,
                top: tile.top,
              }}
              draggable={false}
            />
          ))}

          {validItems.map((item) => {
            const point = project(
              Number(item.latitude),
              Number(item.longitude),
              zoom
            );

            const left = point.x - center.x + width / 2;
            const top = point.y - center.y + height / 2;

            return (
              <div
                key={item.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left, top }}
                title={item.office_name || item.location_name || 'Location'}
              >
                <div
                  className="h-4 w-4 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: getColor(item.status) }}
                />
              </div>
            );
          })}
        </div>
      </div>

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
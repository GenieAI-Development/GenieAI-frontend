"use client";

import { useEffect, useRef } from "react";

type Point = {
  latitude: number;
  longitude: number;
  name: string;
};

export function DeliveryRouteMap({
  destination,
  routeCoordinates,
  warehouse,
}: {
  destination: Point;
  routeCoordinates: Array<[number, number]>;
  warehouse: Point;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapElementRef.current || routeCoordinates.length < 2) return;

    let isDisposed = false;
    let map: import("leaflet").Map | null = null;

    void import("leaflet").then((leaflet) => {
      if (isDisposed || !mapElementRef.current) return;

      map = leaflet.map(mapElementRef.current, {
        attributionControl: true,
        scrollWheelZoom: false,
        zoomControl: true,
      });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(map);

      const route = routeCoordinates.map(([longitude, latitude]) =>
        leaflet.latLng(latitude, longitude),
      );
      const markerIcon = (label: string, color: string) =>
        leaflet.divIcon({
          className: "",
          html: `<span style="display:grid;place-items:center;width:28px;height:28px;border:3px solid white;border-radius:9999px;background:${color};box-shadow:0 2px 8px rgba(10,31,58,.35);color:white;font:700 12px/1 sans-serif">${label}</span>`,
          iconAnchor: [14, 14],
          iconSize: [28, 28],
        });

      leaflet
        .polyline(route, { color: "#B3872F", weight: 5, opacity: 0.9 })
        .addTo(map);
      leaflet
        .marker([warehouse.latitude, warehouse.longitude], {
          icon: markerIcon("W", "#0B2748"),
          title: warehouse.name,
        })
        .bindTooltip(`Warehouse: ${warehouse.name}`)
        .addTo(map);
      leaflet
        .marker([destination.latitude, destination.longitude], {
          icon: markerIcon("D", "#B25A2E"),
          title: destination.name,
        })
        .bindTooltip(`Delivery: ${destination.name}`)
        .addTo(map);
      map.fitBounds(leaflet.latLngBounds(route), { padding: [28, 28] });
    });

    return () => {
      isDisposed = true;
      map?.remove();
    };
  }, [destination, routeCoordinates, warehouse]);

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#D7E2EF] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#E4E1D8] px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#B3872F]">Delivery route</p>
          <p className="mt-0.5 text-xs font-semibold text-[#0B2748]">{warehouse.name} to {destination.name}</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-[#5B6B7A]"><span className="h-2.5 w-2.5 rounded-full bg-[#0B2748]" />Warehouse <span className="h-2.5 w-2.5 rounded-full bg-[#B25A2E]" />Destination</div>
      </div>
      <div ref={mapElementRef} className="h-64 w-full" aria-label="Delivery route map" />
    </section>
  );
}

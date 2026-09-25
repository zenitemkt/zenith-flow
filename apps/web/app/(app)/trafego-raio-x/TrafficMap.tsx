"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface TrafficMapPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusKm: number | null;
  campaignId: string;
  campaignName: string;
}

const PALETTE = ["#FF2B00", "#3B82F6", "#16A36A", "#F59E0B", "#A855F7", "#14B8A6", "#EF4444", "#64748B"];

function colorForCampaign(campaignId: string, campaignIds: string[]): string {
  const index = campaignIds.indexOf(campaignId);
  return PALETTE[index % PALETTE.length]!;
}

/**
 * Leaflet + OpenStreetMap, de propósito — sem chave de API. O pedido do
 * Kevin abria espaço pro Google Maps, mas isso exigiria configurar mais uma
 * credencial externa (Google Cloud, faturamento) só pra desenhar pino/raio;
 * Leaflet cobre o mesmo resultado visual sem essa dependência. Reversível se
 * um caso de uso real pedir o Google Maps depois (ver docs/DECISIONS.md).
 */
export function TrafficMap({ points }: { points: TrafficMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const campaignIds = Array.from(new Set(points.map((p) => p.campaignId)));
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));

      for (const point of points) {
        const color = colorForCampaign(point.campaignId, campaignIds);
        const popup = `<strong>${point.label}</strong><br/>${point.campaignName}${
          point.radiusKm ? `<br/>Raio: ${point.radiusKm} km` : ""
        }`;
        if (point.radiusKm) {
          L.circle([point.lat, point.lng], {
            radius: point.radiusKm * 1000,
            color,
            fillColor: color,
            fillOpacity: 0.12,
            weight: 1.5,
          })
            .addTo(map)
            .bindPopup(popup);
        }
        L.circleMarker([point.lat, point.lng], {
          radius: 6,
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 1.5,
        })
          .addTo(map)
          .bindPopup(popup);
      }

      map.fitBounds(bounds.pad(0.2));
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-[#E4E7EC] bg-[#FAFAFB] text-sm text-[#98A2B3]">
        Nenhum ponto cadastrado ainda — abra uma campanha acima e clique em &quot;Ponto no mapa&quot;.
      </div>
    );
  }

  return <div ref={containerRef} className="h-[280px] w-full overflow-hidden rounded-xl border border-[#E4E7EC]" />;
}

"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { DEMO_MAP } from "./demo-data";

/** "Onde estamos anunciando": pino em Americana, raio vermelho e bairros excluídos em amarelo. */
export function DemoMap() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: true, zoomControl: true }).setView(DEMO_MAP.center, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
      L.circle(DEMO_MAP.center, { radius: DEMO_MAP.radiusMeters, color: "#FF2B00", weight: 2, fillColor: "#FF2B00", fillOpacity: 0.12 }).addTo(map);
      L.circleMarker(DEMO_MAP.center, { radius: 9, color: "#fff", weight: 3, fillColor: "#FF2B00", fillOpacity: 1 })
        .addTo(map)
        .bindTooltip("Americana (SP): centro da campanha", { direction: "top" });
      for (const zone of DEMO_MAP.excluded) {
        L.circle(zone.center, { radius: zone.radius, color: "#EAB308", weight: 2, dashArray: "6 4", fillColor: "#FACC15", fillOpacity: 0.35 })
          .addTo(map)
          .bindTooltip(`${zone.name}: fora da campanha`, { direction: "top" });
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return <div ref={ref} className="h-[360px] w-full overflow-hidden rounded-2xl" />;
}

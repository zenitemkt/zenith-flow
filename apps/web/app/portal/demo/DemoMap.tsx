"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { DEMO_MAP } from "./demo-data";

/** "Onde estamos anunciando": três raios verdes (Americana, Santa Bárbara e Nova Odessa) e bairros excluídos em vermelho. */
export function DemoMap() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: true, zoomControl: true }).setView(DEMO_MAP.areas[0]!.center, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
      const group = L.featureGroup().addTo(map);
      for (const area of DEMO_MAP.areas) {
        const km = (area.radius / 1000).toLocaleString("pt-BR");
        L.circle(area.center, { radius: area.radius, color: "#12B76A", weight: 2, fillColor: "#12B76A", fillOpacity: 0.18 })
          .addTo(group)
          .bindTooltip(`${area.name}: raio de ${km} km`, { direction: "top" });
        L.circleMarker(area.center, { radius: 7, color: "#fff", weight: 3, fillColor: "#039855", fillOpacity: 1 })
          .addTo(map)
          .bindTooltip(`${area.name} (SP)`, { direction: "top" });
      }
      for (const zone of DEMO_MAP.excluded) {
        L.circle(zone.center, { radius: zone.radius, color: "#D92D20", weight: 2, dashArray: "6 4", fillColor: "#F04438", fillOpacity: 0.45 })
          .addTo(map)
          .bindTooltip(`${zone.name}: fora da campanha`, { direction: "top" });
      }
      map.fitBounds(group.getBounds(), { padding: [16, 16] });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return <div ref={ref} className="h-[380px] w-full overflow-hidden rounded-2xl" />;
}

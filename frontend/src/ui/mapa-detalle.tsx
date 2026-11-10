/**
 * Mapa de la página dedicada de una propiedad.
 *
 * Muestra en un solo Leaflet: el inmueble (casa), el punto de trabajo del
 * usuario (punto rojo) y su zona de búsqueda (círculo azul o polígono), para
 * ver de un vistazo la relación entre las tres cosas.
 */

"use client";

import { useEffect, useRef } from "react";

import type { ZonaSeleccion } from "./mapa-zona";
import "leaflet/dist/leaflet.css";

interface Props {
  inmueble: { lat: number | null; lon: number | null; titulo?: string | null };
  trabajo: { lat: number; lon: number } | null;
  zona: ZonaSeleccion | null;
}

type Leaflet = typeof import("leaflet");

export function MapaDetalle({ inmueble, trabajo, zona }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    let mapa: import("leaflet").Map | null = null;

    (async () => {
      const L: Leaflet = await import("leaflet");
      if (cancelado || !contenedorRef.current) return;

      const puntos: [number, number][] = [];
      if (inmueble.lat != null && inmueble.lon != null) {
        puntos.push([inmueble.lat, inmueble.lon]);
      }
      if (trabajo) {
        puntos.push([trabajo.lat, trabajo.lon]);
      }
      const centro: [number, number] =
        puntos[0] ?? [-27.469, -58.83];

      mapa = L.map(contenedorRef.current).setView(centro, 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);

      if (inmueble.lat != null && inmueble.lon != null) {
        const icono = L.divIcon({
          className: "marcador-trabajo",
          html: '<span class="marcador-punto marcador-punto--inmueble">🏠</span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([inmueble.lat, inmueble.lon], { icon: icono })
          .addTo(mapa)
          .bindTooltip(inmueble.titulo ?? "Inmueble", { permanent: false });
      }

      if (trabajo) {
        const icono = L.divIcon({
          className: "marcador-trabajo",
          html: '<span class="marcador-punto"></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([trabajo.lat, trabajo.lon], { icon: icono })
          .addTo(mapa)
          .bindTooltip("Tu punto de trabajo", { permanent: false });
      }

      if (zona?.zona_tipo === "radio" && zona.zona_lat != null && zona.zona_lon != null) {
        L.circle([zona.zona_lat, zona.zona_lon], {
          radius: (zona.zona_radio_km ?? 2) * 1000,
          color: "#0284c7",
          fillColor: "#7fb3d5",
          fillOpacity: 0.35,
        }).addTo(mapa);
      } else if (zona?.zona_tipo === "poligono" && zona.zona_puntos?.length) {
        L.polygon(
          zona.zona_puntos.map((p) => [p.lat, p.lon] as [number, number]),
          { color: "#0284c7", fillOpacity: 0.35 },
        ).addTo(mapa);
      }

      if (puntos.length > 1) {
        mapa.fitBounds(L.latLngBounds(puntos), { padding: [30, 30] });
      }
    })();

    return () => {
      cancelado = true;
      mapa?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={contenedorRef}
      className="z-0 h-80 w-full rounded-lg border"
      aria-label="Mapa de la propiedad, tu trabajo y tu zona"
    />
  );
}

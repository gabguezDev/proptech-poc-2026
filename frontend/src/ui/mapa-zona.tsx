/**
 * Mapa para seleccionar la zona de búsqueda.
 *
 * Dos modos:
 *  - **Punto + radio**: un click fija el centro y se pide el radio en km.
 *  - **Polígono**: 5 clicks marcan los vértices y se dibuja la figura.
 *
 * El resultado se entrega como `zona_tipo` + campos en el perfil; el backend
 * calcula `zona_match` por inmueble (dentro/fuera) con Haversine y ray casting.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "leaflet/dist/leaflet.css";

export interface ZonaSeleccion {
  zona_tipo: "radio" | "poligono" | null;
  zona_lat: number | null;
  zona_lon: number | null;
  zona_radio_km: number | null;
  zona_puntos: { lat: number; lon: number }[] | null;
}

const SIN_ZONA: ZonaSeleccion = {
  zona_tipo: null,
  zona_lat: null,
  zona_lon: null,
  zona_radio_km: null,
  zona_puntos: null,
};

type Leaflet = typeof import("leaflet");

export function MapaZona({
  valor,
  onCambiar,
  centro,
}: {
  valor: ZonaSeleccion;
  onCambiar: (zona: ZonaSeleccion) => void;
  centro: { lat: number; lon: number };
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<import("leaflet").Map | null>(null);
  const capaRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [radio, setRadio] = useState(valor.zona_radio_km ?? 2);
  const [puntos, setPuntos] = useState<{ lat: number; lon: number }[]>(
    valor.zona_puntos ?? [],
  );
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;
  const modo = valor.zona_tipo ?? "radio";

  useEffect(() => {
    let cancelado = false;
    let mapa: import("leaflet").Map | null = null;

    (async () => {
      const L: Leaflet = await import("leaflet");
      if (cancelado || !contenedorRef.current) return;
      mapa = L.map(contenedorRef.current).setView([centro.lat, centro.lon], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);
      capaRef.current = L.layerGroup().addTo(mapa);
      mapaRef.current = mapa;

      mapa.on("click", (evento: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = evento.latlng;
        if (modo === "radio") {
          onCambiar({
            zona_tipo: "radio",
            zona_lat: lat,
            zona_lon: lng,
            zona_radio_km: radio,
            zona_puntos: null,
          });
        } else {
          const nuevos = [...puntosRef.current, { lat, lon: lng }].slice(0, 5);
          setPuntos(nuevos);
          if (nuevos.length === 5) {
            onCambiar({
              zona_tipo: "poligono",
              zona_lat: null,
              zona_lon: null,
              zona_radio_km: null,
              zona_puntos: nuevos,
            });
          }
        }
      });
    })();

    return () => {
      cancelado = true;
      mapa?.remove();
      mapaRef.current = null;
      capaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    const capa = capaRef.current;
    if (!mapa || !capa) return;
    capa.clearLayers();
    (async () => {
      const L: Leaflet = await import("leaflet");
      if (valor.zona_tipo === "radio" && valor.zona_lat != null && valor.zona_lon != null) {
        L.circle([valor.zona_lat, valor.zona_lon], {
          radius: (valor.zona_radio_km ?? radio) * 1000,
          color: "#0284c7",
          fillColor: "#7fb3d5",
          fillOpacity: 0.35,
        }).addTo(capa);
        L.marker([valor.zona_lat, valor.zona_lon]).addTo(capa);
      } else if (valor.zona_tipo === "poligono" && valor.zona_puntos?.length) {
        const latLngs = valor.zona_puntos.map((p) => [p.lat, p.lon] as [number, number]);
        L.polygon(latLngs, { color: "#0284c7", fillOpacity: 0.35 }).addTo(capa);
        for (const punto of valor.zona_puntos) {
          L.marker([punto.lat, punto.lon]).addTo(capa);
        }
      } else if (modo === "poligono" && puntos.length > 0) {
        for (const punto of puntos) {
          L.marker([punto.lat, punto.lon]).addTo(capa);
        }
        if (puntos.length > 1) {
          L.polyline(
            puntos.map((p) => [p.lat, p.lon] as [number, number]),
            { color: "#0284c7", dashArray: "6 6" },
          ).addTo(capa);
        }
      }
    })();
  }, [valor, puntos, modo, radio]);

  function limpiar() {
    setPuntos([]);
    onCambiar(SIN_ZONA);
  }

  function cambiarModo(nuevo: "radio" | "poligono") {
    setPuntos([]);
    if (nuevo === "radio") {
      onCambiar({
        zona_tipo: "radio",
        zona_lat: centro.lat,
        zona_lon: centro.lon,
        zona_radio_km: radio,
        zona_puntos: null,
      });
    } else {
      onCambiar({
        zona_tipo: "poligono",
        zona_lat: null,
        zona_lon: null,
        zona_radio_km: null,
        zona_puntos: null,
      });
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={modo === "radio" ? "default" : "outline"}
          onClick={() => cambiarModo("radio")}
        >
          Punto + radio
        </Button>
        <Button
          type="button"
          size="sm"
          variant={modo === "poligono" ? "default" : "outline"}
          onClick={() => cambiarModo("poligono")}
        >
          Polígono (5 puntos)
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={limpiar}>
          Sin zona
        </Button>
      </div>

      <div ref={contenedorRef} className="z-0 h-64 w-full rounded-lg border" aria-label="Mapa de la zona de búsqueda" />

      {modo === "radio" ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="zona-radio">Radio (km)</Label>
            <Input
              id="zona-radio"
              type="number"
              min={0.1}
              step="any"
              value={radio}
              onChange={(e) => {
                const nuevo = Number(e.target.value);
                setRadio(nuevo);
                onCambiar({
                  zona_tipo: "radio",
                  zona_lat: valor.zona_lat ?? centro.lat,
                  zona_lon: valor.zona_lon ?? centro.lon,
                  zona_radio_km: nuevo || null,
                  zona_puntos: null,
                });
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {valor.zona_tipo === "radio"
              ? "Hacé click en el mapa para mover el centro de la zona."
              : "Elegí este modo y hacé click en el mapa para fijar el centro."}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {puntos.length === 0
            ? "Hacé 5 clicks en el mapa para marcar los vértices de la zona."
            : puntos.length < 4
              ? `Marcaste ${puntos.length}/5 vértices. Seguí clickeando el mapa.`
              : "Polígono completo. Los inmuebles dentro de la figura reciben match de zona."}
        </p>
      )}
    </div>
  );
}

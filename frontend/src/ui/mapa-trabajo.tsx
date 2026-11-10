/**
 * Mapa para fijar el punto de trabajo (lat/lon del perfil).
 *
 * Leaflet + OpenStreetMap, sin API key. El mapa vive en un componente cliente:
 * Leaflet se carga con `import()` dentro de `useEffect`, así el prerender del
 * servidor no toca `window`. Hacer click o arrastrar el marcador actualiza
 * `lat`/`lon`, que el formulario envía al backend; la distancia a cada
 * inmueble se calcula allí con las coordenadas del catálogo.
 *
 * Se puede reutilizar en cualquier formulario que pida un punto del perfil o
 * de un inmueble.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lon: number;
  onCambiar: (lat: number, lon: number) => void;
  /** Marcadores informativos (p. ej. inmuebles recomendados). */
  inmuebles?: { id_inmueble: number; lat?: number | null; lon?: number | null }[];
}

type Leaflet = typeof import("leaflet");

export function MapaTrabajo({ lat, lon, onCambiar, inmuebles = [] }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<import("leaflet").Map | null>(null);
  const marcadorRef = useRef<import("leaflet").Marker | null>(null);
  const inmueblesRef = useRef<import("leaflet").LayerGroup | null>(null);
  const alCambiarRef = useRef(onCambiar);
  alCambiarRef.current = onCambiar;
  const [direccion, setDireccion] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let mapa: import("leaflet").Map | null = null;

    (async () => {
      const L: Leaflet = await import("leaflet");
      if (cancelado || !contenedorRef.current) return;

      mapa = L.map(contenedorRef.current).setView([lat, lon], 14);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);

      const icono = L.divIcon({
        className: "marcador-trabajo",
        html: '<span class="marcador-punto"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marcador = L.marker([lat, lon], { draggable: true, icon: icono }).addTo(mapa);
      marcador.bindTooltip("Punto de trabajo (arrastrable)", { permanent: false });
      marcador.on("dragend", () => {
        const posicion = marcador.getLatLng();
        alCambiarRef.current(posicion.lat, posicion.lng);
      });
      mapa.on("click", (evento: import("leaflet").LeafletMouseEvent) => {
        marcador.setLatLng(evento.latlng);
        alCambiarRef.current(evento.latlng.lat, evento.latlng.lng);
      });

      inmueblesRef.current = L.layerGroup().addTo(mapa);
      mapaRef.current = mapa;
      marcadorRef.current = marcador;
    })();

    return () => {
      cancelado = true;
      mapa?.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
      inmueblesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const marcador = marcadorRef.current;
    if (!marcador) return;
    const actual = marcador.getLatLng();
    if (Math.abs(actual.lat - lat) > 1e-9 || Math.abs(actual.lng - lon) > 1e-9) {
      marcador.setLatLng([lat, lon]);
      mapaRef.current?.panTo([lat, lon]);
    }
  }, [lat, lon]);

  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = inmueblesRef.current;
    if (!mapa || !grupo) return;
    grupo.clearLayers();
    (async () => {
      const L: Leaflet = await import("leaflet");
      for (const inmueble of inmuebles) {
        if (inmueble.lat == null || inmueble.lon == null) continue;
        L.circleMarker([inmueble.lat, inmueble.lon], {
          radius: 6,
          color: "#1b4965",
          fillColor: "#7fb3d5",
          fillOpacity: 0.8,
        })
          .addTo(grupo)
          .bindTooltip(`Inmueble #${inmueble.id_inmueble}`);
      }
    })();
  }, [inmuebles]);

  type Sugerencia = { lat: string; lon: string; display_name: string };
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function alEscribir(valor: string) {
    setDireccion(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    const consulta = valor.trim();
    if (consulta.length < 3) {
      setSugerencias([]);
      return;
    }
    temporizador.current = setTimeout(async () => {
      try {
        const caja = `${lon - 1},${lat + 1},${lon + 1},${lat - 1}`;
        const url =
          "https://nominatim.openstreetmap.org/search?format=json&limit=5" +
          `&accept-language=es&viewbox=${encodeURIComponent(caja)}&bounded=0` +
          `&q=${encodeURIComponent(consulta)}`;
        const respuesta = await fetch(url);
        const datos = (await respuesta.json()) as Sugerencia[];
        setSugerencias(datos);
        setAbierto(true);
      } catch {
        setSugerencias([]);
      }
    }, 350);
  }

  function elegirSugerencia(sugerencia: Sugerencia) {
    const latitud = Number(sugerencia.lat);
    const longitud = Number(sugerencia.lon);
    setDireccion(sugerencia.display_name);
    setSugerencias([]);
    setAbierto(false);
    setAviso(null);
    alCambiarRef.current(latitud, longitud);
    mapaRef.current?.flyTo([latitud, longitud], 15);
  }

  async function buscarDireccion() {
    const consulta = direccion.trim();
    if (!consulta) return;
    setBuscando(true);
    setAviso(null);
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=1" +
        `&accept-language=es&q=${encodeURIComponent(consulta)}`;
      const respuesta = await fetch(url);
      const datos = (await respuesta.json()) as Sugerencia[];
      if (!datos.length) {
        setAviso("No se encontró esa dirección. Probá con otra o hacé click en el mapa.");
        return;
      }
      elegirSugerencia(datos[0]);
    } catch {
      setAviso("No se pudo buscar la dirección (se requiere conexión).");
    } finally {
      setBuscando(false);
    }
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setAviso("Tu navegador no soporta geolocalización.");
      return;
    }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        alCambiarRef.current(posicion.coords.latitude, posicion.coords.longitude);
        mapaRef.current?.flyTo(
          [posicion.coords.latitude, posicion.coords.longitude],
          15,
        );
        setBuscando(false);
      },
      () => {
        setAviso("No se pudo obtener tu ubicación.");
        setBuscando(false);
      },
    );
  }

  return (
    <div className="grid gap-2">
      <div
        className="flex flex-wrap items-center gap-2"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void buscarDireccion();
          }
        }}
      >
        <div className="relative min-w-48 flex-1">
          <Input
            type="search"
            placeholder="Buscar dirección (ej. Av. Sarmiento, Resistencia)"
            value={direccion}
            onChange={(e) => alEscribir(e.target.value)}
            onFocus={() => sugerencias.length > 0 && setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 200)}
            aria-label="Buscar dirección"
            role="combobox"
            aria-expanded={abierto}
            aria-autocomplete="list"
          />
          {abierto && sugerencias.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-52 overflow-auto rounded-md border bg-popover text-sm shadow-lg">
              {sugerencias.map((sugerencia, indice) => (
                <li key={`${sugerencia.lat}-${sugerencia.lon}-${indice}`}>
                  <button
                    type="button"
                    className="w-full truncate px-3 py-2 text-left hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      elegirSugerencia(sugerencia);
                    }}
                  >
                    {sugerencia.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => void buscarDireccion()} disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </Button>
        <Button type="button" variant="outline" onClick={usarMiUbicacion} disabled={buscando}>
          Mi ubicación
        </Button>
      </div>
      <div
        ref={contenedorRef}
        className="z-0 h-80 w-full rounded-lg border"
        aria-label="Mapa del punto de trabajo"
      />
      <p className="text-xs text-muted-foreground">
        Hacé click en el mapa o arrastrá el marcador para fijar el punto de
        trabajo. La distancia se calcula contra las coordenadas de cada inmueble.
      </p>
      {aviso && <p className="text-sm text-destructive">{aviso}</p>}
    </div>
  );
}

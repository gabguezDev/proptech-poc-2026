/**
 * Mapa único del perfil: punto de trabajo + zona de búsqueda.
 *
 * Un solo Leaflet con todas las capas:
 *  - marcador del trabajo (arrastrable, click o búsqueda de dirección),
 *  - zona opcional: círculo de radio o polígono de 5 vértices,
 *  - marcadores informativos de los inmuebles recomendados.
 *
 * Comportamiento de click según el modo: en "polígono" suma vértices; en los
 * demás modos mueve el punto de trabajo.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ZonaSeleccion } from "./mapa-zona";
import "leaflet/dist/leaflet.css";

interface Props {
  latTrabajo: number;
  lonTrabajo: number;
  onCambiarTrabajo: (lat: number, lon: number) => void;
  zona: ZonaSeleccion;
  onCambiarZona: (zona: ZonaSeleccion) => void;
  inmuebles?: { id_inmueble: number; lat?: number | null; lon?: number | null }[];
}

type Leaflet = typeof import("leaflet");

const SIN_ZONA: ZonaSeleccion = {
  zona_tipo: null,
  zona_lat: null,
  zona_lon: null,
  zona_radio_km: null,
  zona_puntos: null,
};

export function MapaPerfil({
  latTrabajo,
  lonTrabajo,
  onCambiarTrabajo,
  zona,
  onCambiarZona,
  inmuebles = [],
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<import("leaflet").Map | null>(null);
  const marcadorTrabajoRef = useRef<import("leaflet").Marker | null>(null);
  const marcadorZonaRef = useRef<import("leaflet").Marker | null>(null);
  const capaZonaRef = useRef<import("leaflet").LayerGroup | null>(null);
  const capaInmueblesRef = useRef<import("leaflet").LayerGroup | null>(null);
  const alTrabajoRef = useRef(onCambiarTrabajo);
  alTrabajoRef.current = onCambiarTrabajo;
  const alZonaRef = useRef(onCambiarZona);
  alZonaRef.current = onCambiarZona;
  const modoRef = useRef(zona.zona_tipo ?? "sin");
  modoRef.current = zona.zona_tipo ?? "sin";
  const radioRef = useRef(zona.zona_radio_km ?? 2);
  radioRef.current = zona.zona_radio_km ?? 2;
  const radioNumero = () => {
    const valor = Number(radioTexto);
    return Number.isFinite(valor) && valor > 0 ? valor : 2;
  };

  const [modo, setModo] = useState<"sin" | "radio" | "poligono">(
    zona.zona_tipo === "poligono" ? "poligono" : zona.zona_tipo === "radio" ? "radio" : "sin",
  );
  const [listo, setListo] = useState(false);
  const [version, setVersion] = useState(0);
  const [radioTexto, setRadioTexto] = useState(
    zona.zona_radio_km != null ? String(zona.zona_radio_km) : "2",
  );
  const [puntos, setPuntos] = useState<{ lat: number; lon: number }[]>(zona.zona_puntos ?? []);
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;
  const [direccion, setDireccion] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  type Sugerencia = { lat: string; lon: string; display_name: string };
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelado = false;
    let mapa: import("leaflet").Map | null = null;

    (async () => {
      const L: Leaflet = await import("leaflet");
      if (cancelado || !contenedorRef.current) return;

      mapa = L.map(contenedorRef.current).setView([latTrabajo, lonTrabajo], 13);
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
      const marcador = L.marker([latTrabajo, lonTrabajo], { draggable: true, icon: icono }).addTo(mapa);
      marcador.bindTooltip("Punto de trabajo (arrastrable)", { permanent: false });
      marcador.on("dragend", () => {
        const posicion = marcador.getLatLng();
        alTrabajoRef.current(posicion.lat, posicion.lng);
      });
      marcadorTrabajoRef.current = marcador;

      const iconoZona = L.divIcon({
        className: "marcador-trabajo",
        html: '<span class="marcador-punto marcador-punto--zona"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marcadorZona = L.marker(
        [
          zona.zona_lat ?? latTrabajo,
          zona.zona_lon ?? lonTrabajo,
        ],
        { draggable: true, icon: iconoZona },
      );
      if (modoRef.current === "radio") {
        marcadorZona.addTo(mapa);
      }
      marcadorZona.bindTooltip("Centro de la zona (arrastrable)", { permanent: false });
      marcadorZona.on("dragend", () => {
        const posicion = marcadorZona.getLatLng();
        alZonaRef.current({
          zona_tipo: "radio",
          zona_lat: posicion.lat,
          zona_lon: posicion.lng,
          zona_radio_km: radioRef.current,
          zona_puntos: null,
        });
      });
      marcadorZonaRef.current = marcadorZona;
      capaZonaRef.current = L.layerGroup().addTo(mapa);
      capaInmueblesRef.current = L.layerGroup().addTo(mapa);
      mapaRef.current = mapa;
      setListo(true);
      setVersion((actual) => actual + 1);

      mapa.on("click", (evento: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = evento.latlng;
        if (modoRef.current === "poligono") {
          const nuevos = [...puntosRef.current, { lat, lon: lng }].slice(0, 5);
          setPuntos(nuevos);
          alZonaRef.current({
            zona_tipo: "poligono",
            zona_lat: null,
            zona_lon: null,
            zona_radio_km: null,
            zona_puntos: nuevos,
          });
        } else {
          marcador.setLatLng([lat, lng]);
          alTrabajoRef.current(lat, lng);
        }
      });
    })();

    return () => {
      cancelado = true;
      mapa?.remove();
      mapaRef.current = null;
      marcadorTrabajoRef.current = null;
      marcadorZonaRef.current = null;
      capaZonaRef.current = null;
      capaInmueblesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const marcador = marcadorTrabajoRef.current;
    if (!marcador) return;
    const actual = marcador.getLatLng();
    if (Math.abs(actual.lat - latTrabajo) > 1e-9 || Math.abs(actual.lng - lonTrabajo) > 1e-9) {
      marcador.setLatLng([latTrabajo, lonTrabajo]);
      mapaRef.current?.panTo([latTrabajo, lonTrabajo]);
    }
  }, [latTrabajo, lonTrabajo]);

  useEffect(() => {
    if (!listo) return;
    const mapa = mapaRef.current;
    if (!mapa || zona.zona_lat == null || zona.zona_lon == null) return;
    const puntosMapa: [number, number][] = [
      [latTrabajo, lonTrabajo],
      [zona.zona_lat, zona.zona_lon],
    ];
    if (zona.zona_tipo === "poligono" && zona.zona_puntos?.length) {
      for (const p of zona.zona_puntos) puntosMapa.push([p.lat, p.lon]);
    }
    mapa.fitBounds(puntosMapa, { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  useEffect(() => {
    const marcador = marcadorZonaRef.current;
    const mapa = mapaRef.current;
    if (!marcador || !mapa) return;
    if (modo === "radio") {
      mapa.addLayer(marcador);
      if (zona.zona_lat != null && zona.zona_lon != null) {
        const actual = marcador.getLatLng();
        if (Math.abs(actual.lat - zona.zona_lat) > 1e-9 || Math.abs(actual.lng - zona.zona_lon) > 1e-9) {
          marcador.setLatLng([zona.zona_lat, zona.zona_lon]);
        }
      }
    } else {
      mapa.removeLayer(marcador);
    }
  }, [modo, zona.zona_lat, zona.zona_lon, listo, version]);

  useEffect(() => {
    const capa = capaZonaRef.current;
    if (!capa) return;
    capa.clearLayers();
    (async () => {
      const L: Leaflet = await import("leaflet");
      const iconoVertice = L.divIcon({
        className: "marcador-trabajo",
        html: '<span class="marcador-punto marcador-punto--zona"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const dibujarVertices = (lista: { lat: number; lon: number }[]) => {
        lista.forEach((punto, indice) => {
          const marcador = L.marker([punto.lat, punto.lon], {
            icon: iconoVertice,
            draggable: true,
          }).addTo(capa);
          marcador.bindTooltip(`Vértice ${indice + 1} (arrastrable)`, { permanent: false });
          marcador.on("dragend", () => {
            const posicion = marcador.getLatLng();
            const nuevos = lista.map((p, i) =>
              i === indice ? { lat: posicion.lat, lon: posicion.lng } : p,
            );
            setPuntos(nuevos);
            alZonaRef.current({
              zona_tipo: "poligono",
              zona_lat: null,
              zona_lon: null,
              zona_radio_km: null,
              zona_puntos: nuevos,
            });
          });
        });
      };
      if (zona.zona_tipo === "radio" && zona.zona_lat != null && zona.zona_lon != null) {
        L.circle([zona.zona_lat, zona.zona_lon], {
          radius: (zona.zona_radio_km ?? radioNumero()) * 1000,
          color: "#0284c7",
          fillColor: "#7fb3d5",
          fillOpacity: 0.35,
        }).addTo(capa);
      } else if (zona.zona_tipo === "poligono" && zona.zona_puntos?.length) {
        if (zona.zona_puntos.length >= 3) {
          L.polygon(
            zona.zona_puntos.map((p) => [p.lat, p.lon] as [number, number]),
            { color: "#0284c7", fillOpacity: 0.35 },
          ).addTo(capa);
        } else if (zona.zona_puntos.length === 2) {
          L.polyline(
            zona.zona_puntos.map((p) => [p.lat, p.lon] as [number, number]),
            { color: "#0284c7", dashArray: "6 6" },
          ).addTo(capa);
        }
        dibujarVertices(zona.zona_puntos);
      } else if (modo === "poligono" && puntos.length > 0) {
        dibujarVertices(puntos);
        if (puntos.length > 1) {
          L.polyline(
            puntos.map((p) => [p.lat, p.lon] as [number, number]),
            { color: "#0284c7", dashArray: "6 6" },
          ).addTo(capa);
        }
      }
    })();
  }, [zona, puntos, modo, radioTexto, listo, version]);

  useEffect(() => {
    const capa = capaInmueblesRef.current;
    if (!capa) return;
    capa.clearLayers();
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
          .addTo(capa)
          .bindTooltip(`Inmueble #${inmueble.id_inmueble}`);
      }
    })();
  }, [inmuebles]);

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
        const caja = `${lonTrabajo - 1},${latTrabajo + 1},${lonTrabajo + 1},${latTrabajo - 1}`;
        const respuesta = await fetch(
          "https://nominatim.openstreetmap.org/search?format=json&limit=5" +
            `&accept-language=es&viewbox=${encodeURIComponent(caja)}&bounded=0` +
            `&q=${encodeURIComponent(consulta)}`,
        );
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
    alTrabajoRef.current(latitud, longitud);
    mapaRef.current?.flyTo([latitud, longitud], 15);
  }

  async function buscarDireccion() {
    const consulta = direccion.trim();
    if (!consulta) return;
    setBuscando(true);
    setAviso(null);
    try {
      const respuesta = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&limit=1" +
          `&accept-language=es&q=${encodeURIComponent(consulta)}`,
      );
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
        alTrabajoRef.current(posicion.coords.latitude, posicion.coords.longitude);
        mapaRef.current?.flyTo([posicion.coords.latitude, posicion.coords.longitude], 15);
        setBuscando(false);
      },
      () => {
        setAviso("No se pudo obtener tu ubicación.");
        setBuscando(false);
      },
    );
  }

  function cambiarModo(nuevo: "sin" | "radio" | "poligono") {
    setModo(nuevo);
    setPuntos([]);
    if (nuevo === "sin") {
      alZonaRef.current(SIN_ZONA);
    } else if (nuevo === "radio") {
      alZonaRef.current({
        zona_tipo: "radio",
        zona_lat: latTrabajo,
        zona_lon: lonTrabajo,
        zona_radio_km: radioNumero(),
        zona_puntos: null,
      });
    } else {
      alZonaRef.current({
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
          variant={modo === "sin" ? "default" : "outline"}
          onClick={() => cambiarModo("sin")}
        >
          Sin zona
        </Button>
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
        <span className="text-xs text-muted-foreground">
          Tip: arrastrá cualquier vértice para ajustar el polígono.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Input
            type="search"
            placeholder="Buscar dirección (ej. Av. Sarmiento, Resistencia)"
            value={direccion}
            onChange={(e) => alEscribir(e.target.value)}
            onFocus={() => sugerencias.length > 0 && setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 200)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void buscarDireccion();
              }
            }}
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

      <div ref={contenedorRef} className="z-0 h-80 w-full rounded-lg border" aria-label="Mapa del perfil" />

      {modo === "radio" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="zona-radio">Radio de la zona (km)</Label>
            <Input
              id="zona-radio"
              type="number"
              min={0.1}
              step="any"
              value={radioTexto}
              onChange={(e) => {
                setRadioTexto(e.target.value);
                const nuevo = Number(e.target.value);
                alZonaRef.current({
                  zona_tipo: "radio",
                  zona_lat: zona.zona_lat ?? latTrabajo,
                  zona_lon: zona.zona_lon ?? lonTrabajo,
                  zona_radio_km: Number.isFinite(nuevo) && nuevo > 0 ? nuevo : null,
                  zona_puntos: null,
                });
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            🔴 Punto de trabajo (arrastrable) · 🔵 Centro de la zona (arrastrable,
            independiente de tu trabajo). En este modo, un click en el mapa
            mueve el punto de trabajo.
          </p>
        </div>
      )}

      {modo === "poligono" && (
        <p className="text-xs text-muted-foreground">
          {puntos.length === 0
            ? "Hacé 5 clicks en el mapa para marcar los vértices de la zona."
            : puntos.length < 4
              ? `Marcaste ${puntos.length}/5 vértices. Seguí clickeando el mapa.`
              : "Polígono completo. Los inmuebles dentro de la figura reciben match de zona."}
        </p>
      )}

      {modo === "sin" && (
        <p className="text-xs text-muted-foreground">
          🔴 Punto de trabajo. En este modo, un click en el mapa lo mueve.
        </p>
      )}
      {aviso && <p className="text-sm text-destructive">{aviso}</p>}
    </div>
  );
}

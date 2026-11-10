/**
 * Galería de la tarjeta del ranking.
 *
 * Imagen principal grande + miniaturas abajo + botones para navegar. Al
 * observarse (primer interacción con la galería) se registra como `visto` en
 * el historial del inquilino (`repeticiones` en el backend).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { etiquetasFoto, urlFoto } from "@/lib/fotos";
import type { FotoPublicacion } from "@/lib/tipo";

export function GaleriaRanking({
  idInmueble,
  fotos,
  titulo,
}: {
  idInmueble: number;
  fotos: (string | FotoPublicacion)[];
  titulo?: string | null;
}) {
  const [indice, setIndice] = useState(0);
  const registrado = useRef(false);

  useEffect(() => {
    if (registrado.current) return;
    registrado.current = true;
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_inmueble: idInmueble, tipo: "visto" }),
    }).catch(() => {});
  }, [idInmueble]);

  if (!fotos.length) {
    return (
      <div className="flex h-44 w-full items-center justify-center bg-muted">
        <svg viewBox="0 0 100 80" className="h-14 w-14 text-muted-foreground" aria-hidden>
          <path d="M50 10 L90 40 L80 40 L80 70 L20 70 L20 40 L10 40 Z" fill="currentColor" opacity="0.35" />
        </svg>
      </div>
    );
  }

  const anterior = () => setIndice((i) => (i - 1 + fotos.length) % fotos.length);
  const siguiente = () => setIndice((i) => (i + 1) % fotos.length);
  const urlActual = urlFoto(fotos[indice]);
  const etiquetasActuales = etiquetasFoto(fotos[indice]);

  return (
    <div className="w-full space-y-1.5">
      <div className="relative h-64 w-full overflow-hidden rounded-b-none bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async"
          src={urlActual}
          alt={`${titulo ?? "Inmueble"} — foto ${indice + 1}`}
          className="h-full w-full object-cover"
        />
        {etiquetasActuales.length > 0 && (
          <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            {etiquetasActuales.join(" + ")}
          </span>
        )}
        {fotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={anterior}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={siguiente}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {fotos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto p-1.5">
          {fotos.map((foto, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded border-2 ${
                i === indice ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" decoding="async" src={urlFoto(foto)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

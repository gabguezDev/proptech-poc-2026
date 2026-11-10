/**
 * Jerarquía de vía de alquiler (inmobiliaria vs. dueño directo).
 *
 * Dos elementos ordenables por arrastre: el primero recibe prioridad en el
 * ranking. También hay ↑/↓ para teclado/táctil.
 */

"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";

export type ViaAlquiler = "inmobiliaria" | "dueno";

const ETIQUETAS: Record<ViaAlquiler, string> = {
  inmobiliaria: "🏢 Inmobiliaria",
  dueno: "🏠 Dueño directo",
};

export function JerarquiaAlquiler({
  orden,
  onCambiar,
}: {
  orden: ViaAlquiler[];
  onCambiar: (orden: ViaAlquiler[]) => void;
}) {
  const [arrastrado, setArrastrado] = useState<number | null>(null);

  function mover(desde: number, hasta: number) {
    if (desde === hasta) return;
    const nuevos = [...orden];
    const [item] = nuevos.splice(desde, 1);
    nuevos.splice(hasta, 0, item);
    onCambiar(nuevos);
  }

  return (
    <div className="grid gap-2">
      {orden.map((via, indice) => (
        <div
          key={via}
          draggable
          onDragStart={() => setArrastrado(indice)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (arrastrado != null) mover(arrastrado, indice);
            setArrastrado(null);
          }}
          onDragEnd={() => setArrastrado(null)}
          className="flex cursor-grab items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm shadow-sm active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-bold text-muted-foreground">{indice + 1}º</span>
          <span className="flex-1">{ETIQUETAS[via]}</span>
          <button
            type="button"
            aria-label={`Subir ${ETIQUETAS[via]}`}
            disabled={indice === 0}
            onClick={() => mover(indice, indice - 1)}
            className="rounded p-1 hover:bg-accent disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Bajar ${ETIQUETAS[via]}`}
            disabled={indice === orden.length - 1}
            onClick={() => mover(indice, indice + 1)}
            className="rounded p-1 hover:bg-accent disabled:opacity-30"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Arrastrá el de arriba para darle prioridad en el ranking.
      </p>
    </div>
  );
}

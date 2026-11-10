/**
 * Botones de verificación de una afirmación de la publicación.
 *
 * El visitante que recorrió el inmueble puede decir si **vio**, **no vio** o
 * **no sabe** si la afirmación (p. ej. la distancia a un hospital) es
 * verdadera. Las tres opciones son excluyentes por afirmación.
 */

"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { TipoFeedback } from "@/lib/tipo";

const OPCIONES: { tipo: TipoFeedback; texto: string }[] = [
  { tipo: "vio", texto: "Vio" },
  { tipo: "no_vio", texto: "No vio" },
  { tipo: "no_se", texto: "No sé" },
];

export function BotonesVerificacion({
  idInmueble,
  detalle,
}: {
  idInmueble: number;
  detalle: string;
}) {
  const [elegida, setElegida] = useState<TipoFeedback | null>(null);
  const [visitaConfirmada, setVisitaConfirmada] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((datos) => {
        if (cancelado) return;
        const entradas = Array.isArray(datos) ? datos : [];
        setVisitaConfirmada(
          entradas.some(
            (e: { id_inmueble: number; tipo: string }) =>
              e.id_inmueble === idInmueble && e.tipo === "visita_confirmada",
          ),
        );
        const mia = entradas.find(
          (e: { id_inmueble: number; detalle?: string | null }) =>
            e.id_inmueble === idInmueble && e.detalle === detalle,
        );
        if (mia) setElegida(mia.tipo as TipoFeedback);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [idInmueble, detalle]);

  async function elegir(tipo: TipoFeedback) {
    setElegida(tipo);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_inmueble: idInmueble, tipo, detalle }),
      });
    } catch {
    }
  }

  if (visitaConfirmada === false) {
    return (
      <p className="text-xs text-muted-foreground">
        Para verificar, el propietario debe confirmar tu visita al inmueble.
      </p>
    );
  }

  return (
    <div className="flex gap-1">
      {OPCIONES.map((opcion) => (
        <Button
          key={opcion.tipo}
          type="button"
          size="sm"
          variant={elegida === opcion.tipo ? "default" : "outline"}
          onClick={() => void elegir(opcion.tipo)}
          aria-pressed={elegida === opcion.tipo}
        >
          {opcion.texto}
        </Button>
      ))}
    </div>
  );
}

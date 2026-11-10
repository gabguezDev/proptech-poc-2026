/**
 * Botón de descarte del inquilino en la página dedicada.
 *
 * "Descartar" registra `no_me_gusta` (el inmueble sale de su ranking) y
 * "Revertir descarte" lo quita (el inmueble vuelve al ranking).
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function BotonDescarte({
  idInmueble,
  inicial,
}: {
  idInmueble: number;
  inicial: boolean;
}) {
  const router = useRouter();
  const [descartado, setDescartado] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);

  async function alternar() {
    setOcupado(true);
    try {
      const ruta = descartado
        ? `/api/feedback/${idInmueble}?tipo=no_me_gusta`
        : "/api/feedback";
      const respuesta = await fetch(ruta, {
        method: descartado ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: descartado
          ? undefined
          : JSON.stringify({ id_inmueble: idInmueble, tipo: "no_me_gusta" }),
      });
      if (respuesta.ok) {
        setDescartado(!descartado);
        router.refresh();
      }
    } catch {
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Button
      type="button"
      variant={descartado ? "default" : "outline"}
      disabled={ocupado}
      onClick={() => void alternar()}
      aria-pressed={descartado}
    >
      {descartado ? "Descartado (revertir)" : "Descartar"}
    </Button>
  );
}

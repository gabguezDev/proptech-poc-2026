/**
 * Circuito de visitas del inquilino (página dedicada).
 *
 * Flujos:
 *  - El buscador solicita la visita → el dueño/agente la confirma.
 *  - El dueño/agente notifica al buscador → el buscador confirma su visita.
 *
 * Con la visita confirmada, el buscador puede verificar afirmaciones
 * (vio / no vio / no sé).
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Estado =
  | "nada"
  | "solicitada"
  | "notificada"
  | "confirmada";

export function BotonVisita({ idInmueble }: { idInmueble: number }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("nada");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((datos) => {
        if (cancelado) return;
        const entradas = Array.isArray(datos) ? datos : [];
        const mias = entradas.filter(
          (e: { id_inmueble: number }) => e.id_inmueble === idInmueble,
        );
        if (mias.some((e: { tipo: string }) => e.tipo === "visita_confirmada")) {
          setEstado("confirmada");
        } else if (
          mias.some(
            (e: { tipo: string; detalle?: string | null }) =>
              e.tipo === "visita_solicitada" && e.detalle === "dueno",
          )
        ) {
          setEstado("notificada");
        } else if (
          mias.some((e: { tipo: string }) => e.tipo === "visita_solicitada")
        ) {
          setEstado("solicitada");
        }
      })
      .catch(() => setEstado("nada"));
    return () => {
      cancelado = true;
    };
  }, [idInmueble]);

  async function postear(tipo: string) {
    setOcupado(true);
    try {
      const respuesta = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_inmueble: idInmueble, tipo }),
      });
      if (respuesta.ok) {
        setEstado(tipo === "visita_confirmada" ? "confirmada" : "solicitada");
        router.refresh();
      }
    } catch {
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "confirmada") {
    return (
      <Button type="button" variant="outline" disabled>
        Visita confirmada ✓
      </Button>
    );
  }
  if (estado === "solicitada") {
    return (
      <Button type="button" variant="outline" disabled>
        Visita solicitada (esperando al propietario)
      </Button>
    );
  }
  if (estado === "notificada") {
    return (
      <Button type="button" disabled={ocupado} onClick={() => void postear("visita_confirmada")}>
        {ocupado ? "Confirmando…" : "Confirmé mi visita"}
      </Button>
    );
  }
  return (
    <Button type="button" variant="outline" disabled={ocupado} onClick={() => void postear("visita_solicitada")}>
      {ocupado ? "Enviando…" : "Solicitar visita"}
    </Button>
  );
}

/**
 * Botón circular de favorito (inquilino).
 *
 * Corazón rojo si está guardado, sin color si no. Al pasar el mouse se explica
 * que marcar/desmarcar como favorito afecta al cálculo de emparejamiento de
 * propiedades (el backend le aplica un boost al score en el ranking).
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function BotonFavorito({
  idInmueble,
  inicial = false,
}: {
  idInmueble: number;
  inicial?: boolean;
}) {
  const router = useRouter();
  const [esFavorito, setEsFavorito] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);

  async function alternar() {
    setOcupado(true);
    try {
      const metodo = esFavorito ? "DELETE" : "POST";
      const ruta = esFavorito
        ? `/api/feedback/${idInmueble}?tipo=favorito`
        : "/api/feedback";
      const respuesta = await fetch(ruta, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: esFavorito
          ? undefined
          : JSON.stringify({ id_inmueble: idInmueble, tipo: "favorito" }),
      });
      if (respuesta.ok) {
        setEsFavorito(!esFavorito);
        router.refresh();
      }
    } catch {
    } finally {
      setOcupado(false);
    }
  }

  const texto = esFavorito
    ? "Desmarcar como favorito (afecta al cálculo de emparejamiento de propiedades)"
    : "Marcar como favorito (afecta al cálculo de emparejamiento de propiedades)";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void alternar()}
            disabled={ocupado}
            aria-pressed={esFavorito}
            aria-label={texto}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background shadow transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Heart
              className={
                esFavorito
                  ? "h-5 w-5 fill-red-500 text-red-500"
                  : "h-5 w-5 text-muted-foreground"
              }
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

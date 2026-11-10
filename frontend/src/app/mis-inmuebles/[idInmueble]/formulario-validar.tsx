/**
 * Formulario para validar una afirmación refutada: foto + ubicación.
 *
 * La ubicación se toma primero del GPS de la foto (EXIF) y, si no lo tiene,
 * de la enviada acá.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormularioValidar({
  idInmueble,
  detalle,
}: {
  idInmueble: number;
  detalle: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    const datos = new FormData(evento.currentTarget);
    const foto = datos.get("foto");
    if (!(foto instanceof File)) {
      setError("Elegí una foto del lugar.");
      setEnviando(false);
      return;
    }
    try {
      const respuesta = await fetch(`/api/propiedades/${idInmueble}/validar`, {
        method: "POST",
        body: datos,
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setError(resultado.error ?? "No se pudo validar.");
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo comunicar con el backend.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-2 grid gap-2">
      <input type="hidden" name="detalle" value={detalle} />
      <div className="grid gap-1.5">
        <Label htmlFor={`foto-${detalle}`}>Foto del lugar</Label>
        <Input id={`foto-${detalle}`} name="foto" type="file" accept="image/*" required />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`lat-${detalle}`}>Latitud (si la foto no tiene GPS)</Label>
          <Input id={`lat-${detalle}`} name="lat" type="number" step="any" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`lon-${detalle}`}>Longitud</Label>
          <Input id={`lon-${detalle}`} name="lon" type="number" step="any" />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={enviando} className="w-fit">
        {enviando ? "Validando…" : "Validar con foto"}
      </Button>
    </form>
  );
}

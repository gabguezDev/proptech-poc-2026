/**
 * Subida de fotos/videos a una propiedad (dueño/agente).
 *
 * Los archivos se envían al BFF, que los guarda en el almacenamiento local
 * (SeaweedFS). Cada foto puede etiquetarse por separado con el ambiente que
 * muestra (dormitorio/baño con número; una segunda etiqueta opcional para
 * espacios compartidos como living+comedor). La galería se refresca al terminar.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AMBIENTES,
  AMBIENTES_CON_NUMERO,
  NOMBRES_AMBIENTE,
  seccionQueExcedeTope,
} from "@/lib/fotos";
import type { FotoPublicacion } from "@/lib/tipo";

/** Una foto seleccionada, con su propia etiqueta de ambiente. */
interface EntradaFoto {
  archivo: File;
  ambiente: string;
  numero: string;
  ambiente2: string;
  numero2: string;
}

export function SubirFotos({
  idInmueble,
  fotosExistentes,
}: {
  idInmueble: number;
  fotosExistentes: (string | FotoPublicacion)[];
}) {
  const router = useRouter();
  const [entradas, setEntradas] = useState<EntradaFoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function leerFotos(lista: FileList | null) {
    if (!lista?.length) return;
    const nuevas = Array.from(lista).map((archivo) => ({
      archivo,
      ambiente: "",
      numero: "",
      ambiente2: "",
      numero2: "",
    }));
    setEntradas((actual) => [...actual, ...nuevas].slice(0, 15));
  }

  function actualizarEntrada(indice: number, cambios: Partial<EntradaFoto>) {
    setEntradas((actual) =>
      actual.map((entrada, i) => (i === indice ? { ...entrada, ...cambios } : entrada)),
    );
  }

  function eliminarEntrada(indice: number) {
    setEntradas((actual) => actual.filter((_, i) => i !== indice));
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      for (const entrada of entradas) {
        const cuerpo = new FormData();
        cuerpo.append("archivos", entrada.archivo);
        if (entrada.ambiente) cuerpo.append("ambiente", entrada.ambiente);
        if (entrada.ambiente2) cuerpo.append("ambiente2", entrada.ambiente2);
        if (entrada.numero) cuerpo.append("numero", entrada.numero);
        if (entrada.numero2) cuerpo.append("numero2", entrada.numero2);
        const respuesta = await fetch(`/api/propiedades/${idInmueble}/fotos`, {
          method: "POST",
          body: cuerpo,
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
          setError(resultado.error ?? "No se pudieron subir los archivos.");
          return;
        }
      }
      setEntradas([]);
      router.refresh();
    } catch {
      setError("No se pudo comunicar con el backend.");
    } finally {
      setEnviando(false);
    }
  }

  const seccionExcedida = seccionQueExcedeTope(fotosExistentes, entradas);

  return (
    <div className="grid gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor="archivos">Fotos o videos (máx. 15 en total)</Label>
        <Input
          id="archivos"
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          multiple
          onChange={(e) => leerFotos(e.target.files)}
        />
      </div>

      {entradas.length > 0 && (
        <div className="grid gap-3">
          {entradas.map((entrada, indice) => (
            <div key={`${entrada.archivo.name}-${indice}`} className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
              <p className="w-full truncate text-xs text-muted-foreground">{entrada.archivo.name}</p>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label={`Ambiente de la foto ${indice + 1}`}
                  value={entrada.ambiente}
                  onChange={(e) => actualizarEntrada(indice, { ambiente: e.target.value, numero: "" })}
                  className="h-8 max-w-44 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Sin etiqueta</option>
                  {AMBIENTES.map((clave) => (
                    <option key={clave} value={clave}>{NOMBRES_AMBIENTE[clave]}</option>
                  ))}
                </select>
                {AMBIENTES_CON_NUMERO.includes(entrada.ambiente) && (
                  <Input
                    aria-label={`N.º de ambiente de la foto ${indice + 1}`}
                    type="number"
                    min={1}
                    required
                    placeholder="N.º"
                    value={entrada.numero}
                    onChange={(e) => actualizarEntrada(indice, { numero: e.target.value })}
                    className="h-8 w-20"
                  />
                )}
                <select
                  aria-label={`Segunda etiqueta de la foto ${indice + 1}`}
                  value={entrada.ambiente2}
                  disabled={!entrada.ambiente}
                  onChange={(e) => actualizarEntrada(indice, { ambiente2: e.target.value, numero2: "" })}
                  className="h-8 max-w-44 flex-1 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                >
                  <option value="">Segunda: ninguna</option>
                  {AMBIENTES.filter((clave) => clave !== entrada.ambiente).map((clave) => (
                    <option key={clave} value={clave}>{NOMBRES_AMBIENTE[clave]}</option>
                  ))}
                </select>
                {AMBIENTES_CON_NUMERO.includes(entrada.ambiente2) && (
                  <Input
                    aria-label={`N.º de la segunda etiqueta de la foto ${indice + 1}`}
                    type="number"
                    min={1}
                    required
                    placeholder="N.º"
                    value={entrada.numero2}
                    onChange={(e) => actualizarEntrada(indice, { numero2: e.target.value })}
                    className="h-8 w-20"
                  />
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => eliminarEntrada(indice)} aria-label={`Quitar foto ${indice + 1}`}>
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Etiquetá cada foto con el ambiente que muestra (sin etiqueta si no corresponde). Cada sección admite hasta 2 fotos; la cobertura mejora el score de carga.
      </p>
      {seccionExcedida && (
        <p className="text-sm text-destructive">
          La sección {seccionExcedida} ya tiene 2 fotos (máximo 2).
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" size="sm" disabled={enviando || entradas.length === 0 || seccionExcedida !== null} className="w-fit" onClick={enviar}>
        {enviando ? "Subiendo…" : "Subir a la galería"}
      </Button>
    </div>
  );
}

/**
 * Botón de eliminar con confirmación.
 *
 * Es el único componente cliente de la vista: la acción sigue siendo un server
 * action; el cliente solo pide confirmación antes de enviar el formulario.
 */

"use client";

import { Button } from "@/components/ui/button";

export function BotonEliminar({
  id,
  email,
  accion,
}: {
  id: number;
  email: string;
  accion: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={accion}
      onSubmit={(evento) => {
        if (!window.confirm(`¿Eliminar la cuenta ${email}? Se revocan sus sesiones.`)) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm">
        Eliminar
      </Button>
    </form>
  );
}

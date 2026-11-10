/**
 * Formulario de edición de los datos de la propiedad (dueño/agente).
 *
 * Envía edición parcial al backend (`PUT /propiedades/{id}`): solo cambian
 * los campos enviados. El ownership y el id no se pueden tocar.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Inmueble } from "@/lib/tipo";

export function FormularioEditar({
  propiedad,
  accion,
}: {
  propiedad: Inmueble;
  accion: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={accion} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="titulo">Título del anuncio</Label>
        <Input id="titulo" name="titulo" defaultValue={propiedad.titulo ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="direccion">Dirección completa</Label>
        <Input id="direccion" name="direccion" defaultValue={propiedad.direccion ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="precio">Precio ($/mes)</Label>
          <Input id="precio" name="precio" type="number" min={1} defaultValue={propiedad.precio ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="superficie">Superficie (m²)</Label>
          <Input id="superficie" name="superficie" type="number" min={0} step="any" defaultValue={propiedad.superficie ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="habitaciones">Dormitorios</Label>
          <Input id="habitaciones" name="cantidad_habitaciones" type="number" min={0} defaultValue={propiedad.cantidad_habitaciones ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="banos">Baños</Label>
          <Input id="banos" name="cantidad_banos" type="number" min={1} defaultValue={propiedad.cantidad_banos ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tipologia">Tipología</Label>
          <select
            id="tipologia"
            name="tipologia"
            defaultValue={propiedad.tipologia ?? "departamento"}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            <option value="departamento">Departamento</option>
            <option value="monoambiente">Monoambiente</option>
            <option value="casa">Casa</option>
            <option value="pension">Pensión</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="moneda">Moneda</Label>
          <select
            id="moneda"
            name="moneda"
            defaultValue={propiedad.moneda ?? "ARS"}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="acepta_mascotas" defaultChecked={Boolean(propiedad.acepta_mascotas)} />
          Acepta mascotas
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="tiene_cochera" defaultChecked={Boolean(propiedad.tiene_cochera)} />
          Cochera
        </label>
      </div>
      <Button type="submit" size="sm" className="w-fit">
        Guardar cambios
      </Button>
    </form>
  );
}

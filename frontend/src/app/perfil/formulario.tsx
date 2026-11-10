/**
 * Formulario de edición del perfil del inquilino.
 *
 * Guardar el perfil lo consulta contra `/api/recomendaciones`, que lo deja como
 * último perfil consultado del usuario en el backend. Después redirige al
 * ranking, que ya usa ese perfil.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PreferenciasUsuario } from "@/lib/tipo";
import { JerarquiaAlquiler } from "@/ui/jerarquia-alquiler";
import dynamic from "next/dynamic";

const MapaPerfil = dynamic(() => import("@/ui/mapa-perfil").then((m) => m.MapaPerfil), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-lg bg-muted" />,
});

export function FormularioPerfil({ inicial }: { inicial: PreferenciasUsuario }) {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PreferenciasUsuario>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const esMono = perfil.tipologia_preferida === "monoambiente";

  function cambiar(patch: Partial<PreferenciasUsuario>) {
    setPerfil((actual) => ({ ...actual, ...patch }));
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/recomendaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil, top_k: 5 }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.error ?? "No se pudo guardar el perfil.");
        return;
      }
      router.push("/recomendaciones");
      router.refresh();
    } catch {
      setError("No se pudo comunicar con el backend.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid gap-4 lg:grid-cols-2">
      <fieldset className="grid gap-3 self-start rounded-lg border p-4">
        <legend className="px-1 text-sm font-bold">1. Presupuesto y moneda</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="presupuesto">Presupuesto máximo (ARS)</Label>
          <Input
            id="presupuesto"
            type="number"
            min={1}
            value={perfil.presupuesto_max ?? 250000}
            onChange={(e) => cambiar({ presupuesto_max: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground">Ej.: 250.000 ARS mensuales.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="expensas-max">Tope mensual de expensas (ARS, opcional)</Label>
          <Input
            id="expensas-max"
            type="number"
            min={0}
            value={perfil.expensas_max ?? ""}
            placeholder="Sin tope"
            onChange={(e) =>
              cambiar({
                expensas_max:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="duracion-min">Duración mínima de contrato (meses, opcional)</Label>
          <Input
            id="duracion-min"
            type="number"
            min={1}
            value={perfil.duracion_min ?? ""}
            placeholder="Sin mínimo"
            onChange={(e) =>
              cambiar({
                duracion_min:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={perfil.presupuesto_max_usd != null}
            onChange={(e) =>
              cambiar({
                presupuesto_max_usd: e.target.checked
                  ? perfil.presupuesto_max_usd ?? 650
                  : null,
                moneda_preferida: e.target.checked ? "USD" : "ARS",
              })
            }
          />
          También considerar presupuesto en USD
        </label>
        {perfil.presupuesto_max_usd != null && (
          <div className="grid gap-1.5">
            <Label htmlFor="presupuesto-usd">Presupuesto máximo (USD)</Label>
            <Input
              id="presupuesto-usd"
              type="number"
              min={1}
              value={perfil.presupuesto_max_usd}
              onChange={(e) => cambiar({ presupuesto_max_usd: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Ej.: 650 USD mensuales. Alquileres en ARS y en USD se filtran
              contra su propio tope.
            </p>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3 self-start rounded-lg border p-4">
        <legend className="px-1 text-sm font-bold">2. Estructura buscada</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tipologia">Tipología preferida</Label>
            <select
              id="tipologia"
              value={perfil.tipologia_preferida ?? "depto"}
              onChange={(e) => {
                const tip = e.target.value;
                cambiar(
                  tip === "monoambiente"
                    ? {
                        tipologia_preferida: tip,
                        cant_dormitorios_min: 0,
                        cant_banos_min: 1,
                        requiere_cocina_separada: false,
                        requiere_living_separado: false,
                        requiere_lavadero: false,
                      }
                    : { tipologia_preferida: tip },
                );
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="depto">Departamento</option>
              <option value="casa">Casa</option>
              <option value="monoambiente">Monoambiente</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dormitorios">Dormitorios (mín.)</Label>
            <Input
              id="dormitorios"
              type="number"
              min={0}
              disabled={esMono}
              title={esMono ? "Un monoambiente no tiene dormitorios separados" : undefined}
              value={perfil.cant_dormitorios_min ?? 1}
              onChange={(e) => cambiar({ cant_dormitorios_min: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="banos">Baños (mín.)</Label>
            <Input
              id="banos"
              type="number"
              min={0}
              disabled={esMono}
              title={esMono ? "Un monoambiente tiene 1 baño" : undefined}
              value={perfil.cant_banos_min ?? 1}
              onChange={(e) => cambiar({ cant_banos_min: Number(e.target.value) })}
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.requiere_balcon)}
            onChange={(e) => cambiar({ requiere_balcon: e.target.checked })}
          />
          Requiere balcón
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.requiere_amoblado)}
            onChange={(e) => cambiar({ requiere_amoblado: e.target.checked })}
          />
          Requiere amoblado
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.requiere_cocina_separada)}
            disabled={esMono}
            onChange={(e) => cambiar({ requiere_cocina_separada: e.target.checked })}
          />
          Cocina separada
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.requiere_living_separado)}
            disabled={esMono}
            onChange={(e) => cambiar({ requiere_living_separado: e.target.checked })}
          />
          Living separado
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.requiere_lavadero)}
            disabled={esMono}
            onChange={(e) => cambiar({ requiere_lavadero: e.target.checked })}
          />
          Lavadero
        </label>
        <div className="grid gap-1.5">
          <Label htmlFor="superficie-min">Superficie mínima (m², opcional)</Label>
          <Input
            id="superficie-min"
            type="number"
            min={0}
            step="any"
            value={perfil.superficie_min ?? ""}
            placeholder="Sin mínimo"
            onChange={(e) =>
              cambiar({
                superficie_min:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.planta_baja_deseada)}
            onChange={(e) => cambiar({ planta_baja_deseada: e.target.checked })}
          />
          Planta baja
        </label>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Amenities (edificio o casa)</span>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(perfil.requiere_quincho)} onChange={(e) => cambiar({ requiere_quincho: e.target.checked })} />
            Quincho
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(perfil.requiere_terraza)} onChange={(e) => cambiar({ requiere_terraza: e.target.checked })} />
            Terraza
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(perfil.requiere_piscina)} onChange={(e) => cambiar({ requiere_piscina: e.target.checked })} />
            Piscina
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(perfil.requiere_ascensor)} onChange={(e) => cambiar({ requiere_ascensor: e.target.checked })} />
            Ascensor
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 self-start rounded-lg border p-4">
        <legend className="px-1 text-sm font-bold">3. Garantías que podés ofrecer</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.tiene_garantia_recibo)}
            onChange={(e) => cambiar({ tiene_garantia_recibo: e.target.checked })}
          />
          Recibo de sueldo
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.tiene_garantia_prop)}
            onChange={(e) => cambiar({ tiene_garantia_prop: e.target.checked })}
          />
          Garantía propietaria
        </label>
        <div className="grid gap-1.5">
          <Label>Preferencia de vía de alquiler (orden de jerarquía)</Label>
          <JerarquiaAlquiler
            orden={
              perfil.preferencia_alquiler === "dueno_primero"
                ? ["dueno", "inmobiliaria"]
                : ["inmobiliaria", "dueno"]
            }
            onCambiar={(orden) =>
              cambiar({
                preferencia_alquiler:
                  orden[0] === "inmobiliaria"
                    ? "inmobiliaria_primero"
                    : "dueno_primero",
              })
            }
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 self-start rounded-lg border p-4">
        <legend className="px-1 text-sm font-bold">4. Convivencia y hábitos</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.tiene_mascota)}
            onChange={(e) => cambiar({ tiene_mascota: e.target.checked })}
          />
          Tiene mascota
        </label>
        {perfil.tiene_mascota && (
          <div className="grid gap-1.5 pl-6">
            <Label htmlFor="tipo-mascota">Tipo de mascota</Label>
            <select
              id="tipo-mascota"
              value={perfil.tipo_mascota ?? ""}
              onChange={(e) => cambiar({ tipo_mascota: e.target.value || null })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="">No especifica</option>
              <option value="perro">Perro</option>
              <option value="gato">Gato</option>
            </select>
          </div>
        )}
        {perfil.tiene_mascota && (
          <div className="grid gap-1.5 pl-6">
            <Label htmlFor="tamano-mascota-perfil">Tamaño de tu mascota</Label>
            <select
              id="tamano-mascota-perfil"
              value={perfil.tamano_mascota ?? ""}
              onChange={(e) => cambiar({ tamano_mascota: e.target.value || null })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="">No especifica</option>
              <option value="chico">Pequeño</option>
              <option value="mediano">Mediano</option>
              <option value="grande">Grande</option>
            </select>
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.tiene_hijos)}
            onChange={(e) => cambiar({ tiene_hijos: e.target.checked })}
          />
          Tiene hijos
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.requiere_cochera)}
            onChange={(e) => cambiar({ requiere_cochera: e.target.checked })}
          />
          Requiere cochera
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.hace_home_office)}
            onChange={(e) => cambiar({ hace_home_office: e.target.checked })}
          />
          Trabaja desde la casa
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(perfil.hace_deporte)}
            onChange={(e) => cambiar({ hace_deporte: e.target.checked })}
          />
          Hace ejercicio/va al gym
        </label>
        <div className="grid gap-1.5">
          <Label htmlFor="transporte">Medio de transporte principal</Label>
          <select
            id="transporte"
            value={perfil.medio_transporte_principal ?? "colectivo"}
            onChange={(e) => cambiar({ medio_transporte_principal: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            <option value="auto">Auto</option>
            <option value="colectivo">Colectivo</option>
            <option value="a_pie">A pie</option>
            <option value="bici">Bici</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ruido">Tolerancia al ruido</Label>
          <select
            id="ruido"
            value={perfil.nivel_tolerancia_ruido ?? "indiferente"}
            onChange={(e) => cambiar({ nivel_tolerancia_ruido: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            <option value="bajo">Baja (busca silencio)</option>
            <option value="indiferente">Indiferente</option>
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-2 self-start rounded-lg border p-4 lg:col-span-2">
        <legend className="px-1 text-sm font-bold">5. Punto de trabajo y zona de búsqueda</legend>
        <MapaPerfil
          latTrabajo={perfil.lat_trabajo}
          lonTrabajo={perfil.lon_trabajo}
          onCambiarTrabajo={(lat, lon) => cambiar({ lat_trabajo: lat, lon_trabajo: lon })}
          zona={{
            zona_tipo: perfil.zona_tipo ?? null,
            zona_lat: perfil.zona_lat ?? null,
            zona_lon: perfil.zona_lon ?? null,
            zona_radio_km: perfil.zona_radio_km ?? null,
            zona_puntos: perfil.zona_puntos ?? null,
          }}
          onCambiarZona={(zona) => cambiar(zona)}
        />
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="lat">Latitud</Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={perfil.lat_trabajo}
              onChange={(e) => cambiar({ lat_trabajo: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lon">Longitud</Label>
            <Input
              id="lon"
              type="number"
              step="any"
              value={perfil.lon_trabajo}
              onChange={(e) => cambiar({ lon_trabajo: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="distancia">Distancia máxima (km)</Label>
            <Input
              id="distancia"
              type="number"
              min={0}
              step="any"
              value={perfil.distancia_max_trabajo_km ?? 5}
              onChange={(e) => cambiar({ distancia_max_trabajo_km: Number(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      {error && <p className="text-sm text-destructive lg:col-span-2">{error}</p>}
      <div className="lg:col-span-2">
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar perfil y ver ranking"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Constructor de ambientes (alta de propiedad).
 *
 * Dos planos de descripción:
 *  1. "Ambientes": qué espacios tiene (Comedor, Cocina, Lavadero, Dormitorio,
 *     Baño) con radios exclusivos y contadores para instancias repetibles.
 *  2. "Combinaciones": cómo están unidos (living comedor, cocina comedor,
 *     suite, lavadero separado…).
 *
 * Al guardar, el alta deriva los booleanos del esquema (`cocina_separada`,
 * `living_separado`, `tiene_lavadero`, `lavadero_separado`,
 * `cantidad_habitaciones`, `cantidad_banos`, `cantidad_banos_en_suite`) y
 * adjunta los grupos en `ambientes`.
 */

"use client";

import { useState } from "react";

/** Un ambiente: espacios unidos y flag "separado" (Lavadero).
 * `numero` distingue instancias repetibles (dormitorio 1, baño 2…). */
export interface AmbienteCrudo {
  espacios: string[];
  separado: boolean;
  numero?: number | null;
}

const OP_TALLOCIONES = ["", "separado", "living_comedor"] as const;
const OP_COCINA = ["", "separada", "integrada"] as const;
const OP_LAVADERO = ["", "lavadero", "lavadero_separado"] as const;

interface Estado {
  comedor: (typeof OP_TALLOCIONES)[number];
  cocina: (typeof OP_COCINA)[number];
  lavadero: (typeof OP_LAVADERO)[number];
  dormitorios: number;
  banos: number;
  suites: number;
}

/** Estado inicial: Living + Cocina separada + Dormitorio 1 + Baño 1 + Lavadero. */
export const AMBIENTES_POR_DEFECTO: AmbienteCrudo[] = [
  { espacios: ["living"], separado: false },
  { espacios: ["cocina"], separado: false },
  { espacios: ["dormitorio"], separado: false, numero: 1 },
  { espacios: ["bano"], separado: false, numero: 1 },
  { espacios: ["lavadero"], separado: false },
];

/** Construye la lista de grupos de ambientes desde el estado elegido.
 *
 * Composición (sin tabla de casos): el comedor se une al living cuando es
 * "living comedor" (o va solo cuando es "separado"); la cocina integrada se
 * abre al comedor (si hay) o al living; la separada va sola.
 */
function construirAmbientes(estado: Estado): AmbienteCrudo[] {
  const items: AmbienteCrudo[] = [];

  const living: AmbienteCrudo = { espacios: ["living"], separado: false };
  if (estado.comedor === "living_comedor") {
    living.espacios.push("comedor");
  }

  const comedorSolo: AmbienteCrudo | null =
    estado.comedor === "separado"
      ? { espacios: ["comedor"], separado: true }
      : null;

  items.push(living);

  if (estado.cocina !== "") {
    const destino =
      estado.cocina === "integrada"
        ? comedorSolo ?? living
        : { espacios: [] as string[], separado: false };
    destino.espacios.push("cocina");
    if (destino !== living && destino !== comedorSolo) {
      items.push(destino);
    }
  }

  if (comedorSolo) {
    items.push(comedorSolo);
  }

  for (let i = 1; i <= estado.dormitorios; i++) {
    if (i <= estado.suites) {
      items.push({ espacios: ["dormitorio", "bano"], separado: false, numero: i });
    } else {
      items.push({ espacios: ["dormitorio"], separado: false, numero: i });
    }
  }
  for (let j = estado.suites + 1; j <= estado.banos; j++) {
    items.push({ espacios: ["bano"], separado: false, numero: j });
  }

  if (estado.lavadero !== "") {
    items.push({
      espacios: ["lavadero"],
      separado: estado.lavadero === "lavadero_separado",
    });
  }

  return items;
}

function gruposDesdeValor(value: AmbienteCrudo[]): Estado {
  const grupoDe = (clave: string) => value.find((v) => v.espacios.includes(clave));
  const comedor = grupoDe("comedor");
  const cocina = grupoDe("cocina");
  const lavadero = grupoDe("lavadero");
  const dormitorios = value.filter((v) => v.espacios.includes("dormitorio")).length;
  const banos = value.filter((v) => v.espacios.includes("bano")).length;
  const suites = value.filter(
    (v) => v.espacios.includes("bano") && v.espacios.includes("dormitorio"),
  ).length;
  return {
    comedor: !comedor ? "" : comedor.espacios.includes("living") ? "living_comedor" : "separado",
    cocina: !cocina ? "" : cocina.espacios.length === 1 ? "separada" : "integrada",
    lavadero: !lavadero ? "" : lavadero.separado ? "lavadero_separado" : "lavadero",
    dormitorios,
    banos,
    suites,
  };
}

export function EditorAmbientes({
  value,
  onCambiar,
}: {
  value: AmbienteCrudo[];
  onCambiar: (ambientes: AmbienteCrudo[]) => void;
}) {
  const [estado, setEstado] = useState<Estado>(() => gruposDesdeValor(value));

  function aplicar(nuevo: Estado) {
    const suites = Math.min(
      nuevo.suites,
      Math.min(nuevo.dormitorios, nuevo.banos),
    );
    nuevo.suites = suites;
    setEstado(nuevo);
    onCambiar(construirAmbientes(nuevo));
  }

  function cambiaContador(
    clave: "dormitorios" | "banos" | "suites",
    delta: number,
  ) {
    const nuevo = { ...estado };
    if (clave === "dormitorios") nuevo.dormitorios = Math.min(6, Math.max(0, nuevo.dormitorios + delta));
    if (clave === "banos") nuevo.banos = Math.min(6, Math.max(0, nuevo.banos + delta));
    if (clave === "suites") nuevo.suites = Math.min(3, Math.max(0, nuevo.suites + delta));
    aplicar(nuevo);
  }

  function opcionRadio(
    clave: "comedor" | "cocina" | "lavadero",
    valor: string,
    etiqueta: string,
  ) {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="radio"
          name={`ambiente-${clave}`}
          checked={estado[clave] === valor}
          onChange={() => aplicar({ ...estado, [clave]: valor })}
        />
        {etiqueta}
      </label>
    );
  }

  function contador(
    clave: "dormitorios" | "banos" | "suites",
    etiqueta: string,
    ayuda: string,
  ) {
    const valor = estado[clave];
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{etiqueta}</span>
        <button
          type="button"
          aria-label={`Quitar un ${etiqueta.toLowerCase()}`}
          disabled={valor <= 0}
          onClick={() => cambiaContador(clave, -1)}
          className="rounded border px-2.5 py-1 text-sm hover:bg-accent disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-6 text-center text-sm font-bold">{valor}</span>
        <button
          type="button"
          aria-label={`Agregar un ${etiqueta.toLowerCase()}`}
          onClick={() => cambiaContador(clave, +1)}
          className="rounded border px-2.5 py-1 text-sm hover:bg-accent"
        >
          +
        </button>
        <span className="text-xs text-muted-foreground">{ayuda}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <span className="text-sm font-medium">Comedor</span>
        <div className="flex flex-wrap gap-4 pl-1">
          {opcionRadio("comedor", "", "Sin comedor")}
          {opcionRadio("comedor", "separado", "Comedor separado")}
          {opcionRadio("comedor", "living_comedor", "Living comedor")}
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Cocina</span>
        <div className="flex flex-wrap gap-4 pl-1">
          {opcionRadio("cocina", "", "Sin cocina")}
          {opcionRadio("cocina", "separada", "Cocina separada")}
          {opcionRadio("cocina", "integrada", "Cocina integrada (living o comedor)")}
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Lavadero</span>
        <div className="flex flex-wrap gap-4 pl-1">
          {opcionRadio("lavadero", "", "Sin lavadero")}
          {opcionRadio("lavadero", "lavadero", "Lavadero")}
          {opcionRadio("lavadero", "lavadero_separado", "Lavadero separado")}
        </div>
      </div>

      <div className="grid gap-3">
        {contador("dormitorios", "Dormitorios", "Cada uno es un dormitorio 1, 2, 3…")}
        {contador("banos", "Baños", "Cada uno es un baño 1, 2, 3…")}
        {contador("suites", "Suites", "dormitorios con baño propio (Dormitorio + Baño)")}
      </div>

      <p className="text-xs text-muted-foreground">
        Elegí las combinaciones del inmueble: living comedor, cocina comedor,
        cocina separada, comedor separado, suites y lavadero separado. Las
        cantidades de dormitorios y baños valen según lo que elegiste.
      </p>
    </div>
  );
}

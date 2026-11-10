/**
 * Tabla de desglose con ayuda contextual.
 *
 * Cada porcentaje tiene un ícono de ayuda: al pasar el mouse se explica qué mide
 * esa dimensión o grupo. Lo usan el ranking del inquilino (sub-scores del
 * Match) y el detalle de completitud del dueño (score por grupo).
 */

"use client";

import { HelpCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ItemDesglose {
  etiqueta: string;
  valor: number;
  ayuda: string;
}

export function DesgloseXai({ items }: { items: ItemDesglose[] }) {
  return (
    <TooltipProvider delayDuration={150}>
      <table className="w-full max-w-sm text-sm">
        <tbody>
          {items.map((item) => (
            <tr key={item.etiqueta} className="border-b last:border-0">
              <td className="py-1">
                <span className="inline-flex items-center gap-1">
                  {item.etiqueta}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle
                        className="h-3.5 w-3.5 shrink-0 cursor-help text-muted-foreground"
                        aria-label={`Explicación de ${item.etiqueta}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{item.ayuda}</TooltipContent>
                  </Tooltip>
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">{Math.round(item.valor)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TooltipProvider>
  );
}

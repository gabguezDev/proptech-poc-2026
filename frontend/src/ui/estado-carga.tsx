/** Badge de score de carga (completitud del inmueble), 0-100. */

import { Badge } from "@/components/ui/badge";

export function EstadoCarga({ score }: { score: number }) {
  const variante =
    score >= 90 ? "default" : score >= 60 ? "secondary" : "destructive";
  return <Badge variant={variante}>{score}/100</Badge>;
}

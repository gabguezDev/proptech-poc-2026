/** Placeholder de carga para las fronteras de streaming (`<Suspense>`). */

export function Cargando({ etiqueta = "Cargando…" }: { etiqueta?: string }) {
  return <p className="animate-pulse text-sm text-muted-foreground">{etiqueta}</p>;
}

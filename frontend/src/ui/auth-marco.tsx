/**
 * Marco visual de las pantallas de acceso (ingreso y registro).
 *
 * Panel lateral oscuro con el mensaje de la plataforma, junto a la tarjeta con
 * el formulario. Lo comparten `/ingresar` y `/registrar` para que ambas
 * pantallas tengan el mismo diseño. La barra superior la aporta
 * `ui/barra-superior.tsx`.
 */

function IconoHogar() {
  return (
    <svg
      viewBox="0 0 120 120"
      width="120"
      height="120"
      role="img"
      aria-label="Icono de hogar"
    >
      <circle cx="60" cy="60" r="54" fill="none" stroke="#38bdf8" strokeWidth="3" />
      <path
        d="M60 34 L92 62 L82 62 L82 88 L38 88 L38 62 L28 62 Z"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="70" r="8" fill="#38bdf8" />
    </svg>
  );
}

export function PanelAuth({ subtitulo }: { subtitulo: string }) {
  return (
    <section className="flex flex-col rounded-xl bg-slate-950 p-8 text-white">
      <h2 className="m-0 text-2xl leading-snug">
        Encontrá tu próximo hogar
        <span className="text-sky-400"> ajustado a tu medida</span>
      </h2>
      <p className="m-0 mt-3 max-w-sm text-slate-300">{subtitulo}</p>
      <div className="mt-auto flex justify-center pt-8">
        <IconoHogar />
      </div>
    </section>
  );
}

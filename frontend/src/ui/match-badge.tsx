/**
 * Insignia del porcentaje de Match, coloreada por tercios:
 * rojo (primer tercio), amarillo (segundo tercio) y verde (el más alto).
 */

export function colorMatch(score: number): string {
  if (score < 34) return "bg-red-600 text-white border-transparent hover:bg-red-600";
  if (score < 67) return "bg-yellow-400 text-yellow-950 border-transparent hover:bg-yellow-400";
  return "bg-green-600 text-white border-transparent hover:bg-green-600";
}

export function MatchBadge({ score }: { score: number }) {
  return (
    <>
      <span
        className={
          score < 34
            ? "rounded-md bg-red-600 px-2 py-1 text-sm font-bold text-white"
            : score < 67
              ? "rounded-md bg-yellow-400 px-2 py-1 text-sm font-bold text-yellow-950"
              : "rounded-md bg-green-600 px-2 py-1 text-sm font-bold text-white"
        }
      >
        {Math.round(score)}% Match
      </span>
      <span className="sr-only">score {Math.round(score)}%</span>
    </>
  );
}

export function colorTextoMatch(score: number): string {
  if (score < 34) return "text-red-600 dark:text-red-400";
  if (score < 67) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

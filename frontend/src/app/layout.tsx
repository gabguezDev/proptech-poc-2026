/** Layout raíz del frontend. */

import type { Metadata } from "next";
import { Lato } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/**
 * Fuente Lato del tema (variable de Tailwind, ver `globals.css`).
 * - Cuerpo: Lato Regular (400) — lectura general.
 * - Títulos: Lato Black (900) — jerarquía visual.
 * - Énfasis/datos: Lato Bold (700); texto secundario: Lato Light (300).
 */
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recomendación de alquileres",
  description:
    "Aplicación web de recomendación inteligente de alquileres permanentes",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={lato.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

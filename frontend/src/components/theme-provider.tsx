"use client";

import * as React from "react";
import { ThemeProvider as NextThemes } from "next-themes";

/**
 * Proveedor de tema: modo claro/oscuro según el sistema por defecto.
 * `attribute="class"` aplica `.dark` en `<html>`; el toggle permite cambiarlo
 * en la sesión.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemes>
  );
}

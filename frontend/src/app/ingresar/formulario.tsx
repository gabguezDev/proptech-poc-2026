/** Formulario de acceso (cliente): usa las acciones de servidor del BFF. */

"use client";

import { errorPassword } from "@/lib/password";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accionIngresar, accionRegistrar, type ResultadoFormulario } from "./acciones";

/** Estado inicial de las acciones (sin error). */
const SIN_ERROR: ResultadoFormulario = {};

export default function FormularioAcceso({
  vuelve,
  modo = "ingresar",
}: {
  vuelve: string;
  modo?: "ingresar" | "registrar" | "oferta";
}) {
  const [estadoIngreso, enviarIngreso, ocupadoIngreso] = useActionState(
    accionIngresar,
    SIN_ERROR,
  );
  const [estadoRegistro, enviarRegistro, ocupadoRegistro] = useActionState(
    accionRegistrar,
    SIN_ERROR,
  );
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const esRegistro = modo === "registrar" || modo === "oferta";
  const estado = esRegistro ? estadoRegistro : estadoIngreso;
  const enviar = esRegistro ? enviarRegistro : enviarIngreso;
  const ocupado = esRegistro ? ocupadoIngreso : ocupadoIngreso || ocupadoRegistro;

  function validar(evento: React.FormEvent<HTMLFormElement>) {
    setErrorLocal(null);
    if (!esRegistro) return;
    const datos = new FormData(evento.currentTarget);
    const password = String(datos.get("password") ?? "");
    const motivo = errorPassword(password);
    if (motivo) {
      evento.preventDefault();
      setErrorLocal(motivo);
      return;
    }
    if (password !== String(datos.get("confirmar") ?? "")) {
      evento.preventDefault();
      setErrorLocal("Las contraseñas no coinciden.");
    }
  }

  return (
    <form action={enviar} onSubmit={validar} className="mx-auto grid w-full max-w-md gap-4">
      <input type="hidden" name="vuelve" value={vuelve} />

      {modo === "registrar" && <input type="hidden" name="rol" value="seeker" />}

      {modo === "oferta" && (
        <fieldset className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">¿Cómo vas a publicar?</legend>
          <label className="flex cursor-pointer items-center justify-center gap-2 text-sm">
            <input type="radio" name="rol" value="prop_owner" defaultChecked />
            Soy propietario directo
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 text-sm">
            <input type="radio" name="rol" value="real_estate_agent" />
            Soy agente inmobiliario
          </label>
        </fieldset>
      )}

      <div className="grid gap-1.5 text-center">
        <Label htmlFor="email" className="text-center">Correo Electrónico</Label>
        <Input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={esRegistro ? "nuevo.usuario@ejemplo.com" : "usuario@ejemplo.com"}
          className="text-center"
        />
      </div>

      <div className="grid gap-1.5 text-center">
        <Label htmlFor="password" className="text-center">Contraseña</Label>
        <Input
          id="password"
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete={esRegistro ? "new-password" : "current-password"}
          placeholder={esRegistro ? "8+ caracteres: mayúscula, minúscula, número y símbolo" : "tu contraseña"}
          className="text-center"
        />
      </div>

      {esRegistro && (
        <div className="grid gap-1.5 text-center">
          <Label htmlFor="confirmar" className="text-center">Confirmar Contraseña</Label>
          <Input
            id="confirmar"
            type="password"
            name="confirmar"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="repetí la contraseña"
            className="text-center"
          />
        </div>
      )}

      {!esRegistro && (
        <label className="flex cursor-pointer items-center justify-center gap-2 text-sm">
          <input type="checkbox" name="recordarme" defaultChecked />
          Recordarme
        </label>
      )}

      <Button
        type="submit"
        disabled={ocupado}
        variant={esRegistro ? "default" : "secondary"}
        className="w-full"
      >
        {esRegistro ? "Registrarse" : "Iniciar Sesión"}
      </Button>

      {(errorLocal ?? estado?.error) && (
        <p className="text-center text-sm text-destructive">{errorLocal ?? estado?.error}</p>
      )}
    </form>
  );
}

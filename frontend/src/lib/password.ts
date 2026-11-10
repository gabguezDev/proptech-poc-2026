/**
 * Política de contraseñas (espejo de `validar_password` en el backend).
 *
 * Mínimo 8 caracteres, con al menos una mayúscula, una minúscula, un número y
 * un carácter especial; máximo 72 bytes (límite de bcrypt). La verificación
 * real la hace el backend; esto evita enviar datos que serían rechazados.
 */

const CARACTERES_ESPECIALES = "!@#$%^&*()-_=+[]{};:,.<>/?|~`'\"\\";
const MIN_LARGO = 8;
const MAX_BYTES = 72;

/** Motivo del rechazo, o null si la contraseña cumple la política. */
export function errorPassword(password: string): string | null {
  if (password.length < MIN_LARGO) {
    return `La contraseña debe tener al menos ${MIN_LARGO} caracteres.`;
  }
  if (new TextEncoder().encode(password).length > MAX_BYTES) {
    return `La contraseña no puede superar ${MAX_BYTES} bytes.`;
  }
  if (!/\p{Lu}/u.test(password)) {
    return "La contraseña debe incluir al menos una mayúscula.";
  }
  if (!/\p{Ll}/u.test(password)) {
    return "La contraseña debe incluir al menos una minúscula.";
  }
  if (!/\d/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  if (![...password].some((c) => CARACTERES_ESPECIALES.includes(c))) {
    return "La contraseña debe incluir al menos un carácter especial.";
  }
  return null;
}

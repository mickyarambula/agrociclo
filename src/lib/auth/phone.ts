/** +52 y 10 dígitos — nada de espacios, guiones ni otro país. Usado por el
 * validador del plugin `phoneNumber` en `server.ts`. */
export function telefonoMxValido(telefono: string): boolean {
  return /^\+52\d{10}$/.test(telefono);
}

/* Bandera de "estoy viendo el ciclo de ejemplo, no mi predio real". Punto único
   de verdad para bloquear escrituras en lib/supabase.ts — ver ese archivo. */
let activo = false;

export function activarModoEjemplo(): void {
  activo = true;
}

export function desactivarModoEjemplo(): void {
  activo = false;
}

export function estaEnModoEjemplo(): boolean {
  return activo;
}

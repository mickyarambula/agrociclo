import { registrarEventosUso } from "../server/plataforma";
import { alAbrirForm, alCerrarForm, alGuardar, type EstadoFormActivo } from "./telemetriaLogica";

/* Telemetría de uso: pantallas y formularios, para responder "hasta dónde
   llegó" (Soporte) y "dónde se atoran todos" (Pulso). Única excepción
   deliberada a "nada falla en silencio" del proyecto — ver CLAUDE.md: si no
   hay señal (sin conexión, servidor caído), el evento se pierde callado.
   Nunca se le avisa al productor ni se le interrumpe una captura por esto.

   Regla dura: lo único que viaja es el ID INTERNO de la pantalla o del
   formulario (p. ej. "parcelas", "boleta") — nunca lo que el productor
   tecleó. El servidor (registrarEventosUso) además recorta a solo ese campo,
   así que aunque este archivo tuviera un bug, no hay por dónde se cuele un
   monto o un nombre de verdad.

   Qué cuenta como "se guardó" vs. "se abandonó" vive en telemetriaLogica.ts
   (puro, probado); aquí solo la cola, el temporizador y la llamada al
   servidor. */

const MAX_COLA = 200;
const INTERVALO_MS = 30_000;

let activa = true; // se apaga durante el ciclo de ejemplo: no es captura real
let cola: { tipo: string; nombre: string }[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let listenersListos = false;
let formActivo: EstadoFormActivo = null;

/** Apaga/prende el envío — se usa al entrar/salir del ciclo de ejemplo, que
 *  nunca debe contarse como uso real de un predio. */
export function activarTelemetria(v: boolean): void {
  activa = v;
}

function vaciar(): void {
  if (cola.length === 0) return;
  const lote = cola;
  cola = [];
  registrarEventosUso({ data: { eventos: lote } }).catch(() => {
    /* sin señal, se pierde — ver nota de arriba */
  });
}

function arrancar(): void {
  if (typeof window === "undefined" || timer) return;
  timer = setInterval(vaciar, INTERVALO_MS);
  if (!listenersListos) {
    listenersListos = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") vaciar();
    });
    window.addEventListener("pagehide", vaciar);
  }
}

function encolar(tipo: string, nombre: string): void {
  if (!activa) return;
  // Tope por ventana: si algo se pone a re-disparar como loco, se descarta el
  // excedente en vez de inundar la tabla — nunca truena, nunca avisa.
  if (cola.length >= MAX_COLA) return;
  cola.push({ tipo, nombre });
  arrancar();
}

/** Una pantalla del menú se abrió. Llamar en un efecto sobre `vista` —
 *  React ya deduplica solo (el efecto no corre si el valor no cambió). */
export function registrarPantalla(nombre: string): void {
  encolar("pantalla", nombre);
}

/** Un formulario se abrió. */
export function registrarFormAbierto(nombre: string): void {
  const { estado, abandonoPrevio } = alAbrirForm(formActivo, nombre);
  if (abandonoPrevio) encolar("form_abandonado", abandonoPrevio);
  formActivo = estado;
  encolar("form_abierto", nombre);
}

/** El formulario que estaba abierto se cerró (Cancelar, X, o guardó y
 *  cerró). Si nunca se marcó guardado, cuenta como abandonado. */
export function registrarFormCerrado(): void {
  const { abandono } = alCerrarForm(formActivo);
  if (abandono) encolar("form_abandonado", abandono);
  formActivo = null;
}

/** Se llama desde useOrgWrite en cada escritura exitosa, con su `op`. */
export function marcarEscrituraForm(op: string | undefined): void {
  const { estado, disparaGuardado } = alGuardar(formActivo, op);
  formActivo = estado;
  if (disparaGuardado && estado) encolar("form_guardado", estado.nombre);
}

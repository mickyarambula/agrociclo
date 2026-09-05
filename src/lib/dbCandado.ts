/** Puro, para poder probarlo: ¿esta combinación debe tronar en vez de dejar
 *  arrancar la app? Nunca bloquea un despliegue real (`nodeEnv: "production"`,
 *  lo que pone Vite en build/preview) ni un Postgres que no sea de Supabase —
 *  esto es "no dev contra LA base real de productores", no "no dev con URL".
 *
 *  Vive en su propio archivo (sin importar nada de db.ts, que arranca PGLite
 *  al cargarse) para poder probarlo con `node --test` sin disparar ese
 *  bootstrap. */
export function debeBloquearBaseRealEnDev(opts: {
  nodeEnv: string | undefined;
  databaseUrl: string | undefined;
  permitirExplicitamente: boolean;
}): boolean {
  const esDev = opts.nodeEnv !== "production";
  const apuntaASupabase = !!opts.databaseUrl && /supabase\.(co|com)/i.test(opts.databaseUrl);
  return esDev && apuntaASupabase && !opts.permitirExplicitamente;
}

/** La válvula: PERMITIR_BASE_REAL_EN_DEV=1 abre la base real desde dev para
 *  LEER (verificar las tarjetas del portal, depurar un dato). Mientras esté
 *  abierta, la app no debe escribir eventos de plataforma (uso, errores) —
 *  si no, cada verificación de Miguel siembra "pruebas" en el predio con el
 *  que entró, y el Pulso las cuenta como si fueran de un productor. En
 *  producción nunca aplica: ahí la variable no debe existir y, aunque
 *  existiera, `nodeEnv: "production"` la ignora. */
export function valvulaBaseRealAbiertaEnDev(opts: {
  nodeEnv: string | undefined;
  permitirExplicitamente: boolean;
}): boolean {
  return opts.nodeEnv !== "production" && opts.permitirExplicitamente;
}

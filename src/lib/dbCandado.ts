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

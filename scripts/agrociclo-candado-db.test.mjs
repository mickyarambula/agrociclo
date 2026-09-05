import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { debeBloquearBaseRealEnDev } = await jiti.import("../src/lib/dbCandado.ts");

const SUPABASE_URL = "postgresql://postgres.abc123:pass@aws-1-us-west-2.pooler.supabase.com:5432/postgres";
const OTRA_URL = "postgresql://postgres:pass@localhost:5432/agrociclo_dev";

describe("Candado: dev nunca escribe en la base real de Supabase por accidente", () => {
  it("dev + Supabase + sin permiso explícito → bloquea", () => {
    assert.equal(
      debeBloquearBaseRealEnDev({ nodeEnv: "development", databaseUrl: SUPABASE_URL, permitirExplicitamente: false }),
      true,
    );
  });

  it("dev + Supabase + PERMITIR_BASE_REAL_EN_DEV=1 → deja pasar, a sabiendas", () => {
    assert.equal(
      debeBloquearBaseRealEnDev({ nodeEnv: "development", databaseUrl: SUPABASE_URL, permitirExplicitamente: true }),
      false,
    );
  });

  it("producción (npm run build/preview, o el despliegue real) nunca se bloquea, aunque sea Supabase", () => {
    assert.equal(
      debeBloquearBaseRealEnDev({ nodeEnv: "production", databaseUrl: SUPABASE_URL, permitirExplicitamente: false }),
      false,
    );
  });

  it("sin DATABASE_URL (PGLite local) nunca se bloquea", () => {
    assert.equal(
      debeBloquearBaseRealEnDev({ nodeEnv: "development", databaseUrl: undefined, permitirExplicitamente: false }),
      false,
    );
  });

  it("un Postgres que no es de Supabase (local, otro proveedor) no se bloquea — el candado es de Supabase, no de tener URL", () => {
    assert.equal(
      debeBloquearBaseRealEnDev({ nodeEnv: "development", databaseUrl: OTRA_URL, permitirExplicitamente: false }),
      false,
    );
  });

  it("nodeEnv indefinido (nunca se puso) se trata como dev, no como producción", () => {
    assert.equal(
      debeBloquearBaseRealEnDev({ nodeEnv: undefined, databaseUrl: SUPABASE_URL, permitirExplicitamente: false }),
      true,
    );
  });
});

const { valvulaBaseRealAbiertaEnDev } = await jiti.import("../src/lib/dbCandado.ts");

describe("Válvula: con PERMITIR_BASE_REAL_EN_DEV=1 se lee la base real, no se escriben eventos de plataforma", () => {
  it("dev + permiso explícito → válvula abierta (eventos de uso y errores se descartan)", () => {
    assert.equal(valvulaBaseRealAbiertaEnDev({ nodeEnv: "development", permitirExplicitamente: true }), true);
  });

  it("dev sin permiso → válvula cerrada (PGLite local, los eventos se escriben normal)", () => {
    assert.equal(valvulaBaseRealAbiertaEnDev({ nodeEnv: "development", permitirExplicitamente: false }), false);
  });

  it("producción nunca la considera abierta, aunque alguien deje la variable puesta en Vercel", () => {
    assert.equal(valvulaBaseRealAbiertaEnDev({ nodeEnv: "production", permitirExplicitamente: true }), false);
  });
});

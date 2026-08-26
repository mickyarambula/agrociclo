-- AgroCiclo · org, roles y ledger por organización (Etapa 2 / Fase 4)
-- user_id es TEXT (Better Auth). Una organización por despliegue de rancho.

create table if not exists agrociclo_org (
  id text primary key,
  nombre text not null,
  creado_por text not null,
  creado_en timestamptz not null default now()
);

create table if not exists usuario_rol (
  user_id text primary key,
  organizacion_id text not null references agrociclo_org(id),
  rol text not null,
  ve_finanzas boolean not null default false,
  email text,
  display_name text,
  creado_en timestamptz not null default now()
);
create index if not exists usuario_rol_org_idx on usuario_rol (organizacion_id);

create table if not exists user_ciclo (
  user_id text primary key,
  ciclo_id text not null
);

create table if not exists agrociclo_ledger (
  organizacion_id text primary key references agrociclo_org(id),
  payload jsonb not null,
  actualizado_en timestamptz not null default now()
);

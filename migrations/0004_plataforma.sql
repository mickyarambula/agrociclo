-- Plataforma AgroCiclo: ranchos independientes, consola del operador, atención y FAQ.
-- Un productor = un rancho. El Encargado entra con código de invitación.

alter table agrociclo_org add column if not exists codigo_invitacion text;

create unique index if not exists agrociclo_org_codigo_uidx
  on agrociclo_org (codigo_invitacion)
  where codigo_invitacion is not null;

create table if not exists plataforma_admin (
  user_id text primary key,
  email text,
  display_name text,
  creado_en timestamptz not null default now()
);

create table if not exists plataforma_evento (
  id text primary key,
  tipo text not null,
  organizacion_id text,
  user_id text,
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists plataforma_evento_creado_idx on plataforma_evento (creado_en desc);
create index if not exists plataforma_evento_tipo_idx on plataforma_evento (tipo, creado_en desc);

create table if not exists plataforma_ticket (
  id text primary key,
  organizacion_id text,
  user_id text,
  email text,
  display_name text,
  tipo text not null,
  titulo text not null,
  cuerpo text not null default '',
  estado text not null default 'nueva',
  respuesta text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists plataforma_ticket_estado_idx on plataforma_ticket (estado, creado_en desc);

create table if not exists plataforma_faq (
  id text primary key,
  pregunta text not null,
  respuesta text not null,
  orden int not null default 0,
  publicado boolean not null default true,
  actualizado_en timestamptz not null default now()
);

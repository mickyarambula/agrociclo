-- Celular de atención del operador. Los productores escriben por WhatsApp desde Ayuda.
create table if not exists plataforma_contacto (
  id text primary key,
  telefono text not null default '',
  actualizado_en timestamptz not null default now()
);

insert into plataforma_contacto (id, telefono) values ('default', '')
  on conflict (id) do nothing;

-- Permisos por persona (ver finanzas / editar) y config del rancho.
alter table usuario_rol add column if not exists puede_editar boolean not null default true;
update usuario_rol set puede_editar = false where rol in ('Consulta', 'pendiente');

alter table agrociclo_org add column if not exists config jsonb not null default '{}'::jsonb;

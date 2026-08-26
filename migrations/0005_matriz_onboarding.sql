-- Matriz de permisos por módulo y guía de primer uso.
alter table usuario_rol add column if not exists permisos jsonb not null default '{}'::jsonb;
alter table usuario_rol add column if not exists onboarding_en timestamptz;

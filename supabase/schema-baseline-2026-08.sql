-- AgroCiclo · schema baseline reconstruido 2026-08-26
--
-- NO es un pg_dump del proyecto Supabase oryixvodfqojunnqbkln.
-- Las migraciones se aplicaron ahí y no quedaron archivos locales.
-- Este archivo documenta el ledger que el front y el espejo JS conocen,
-- para no perder el modelo si hay que recrear DEV.
--
-- Cuando haya acceso al proyecto: sustituir por
--   supabase db dump --schema public
-- y commitear el dump real encima de este archivo.

-- ========== tablas ==========

create table if not exists organizacion (
  id uuid primary key,
  nombre text not null,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists ciclo (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  clave text not null,
  nombre text not null,
  fecha_inicio date,
  fecha_fin date,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists productor (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  codigo text,
  nombre text not null,
  contrato text,
  rfc text,
  tipo text,               -- grupo | prestanombre | ...
  activo boolean default true,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists parcela (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid not null references ciclo(id),
  productor_id uuid references productor(id),
  nombre text not null,
  cultivo text,
  ha numeric,
  rend_esperado numeric,
  precio_esperado numeric,
  tenencia text,           -- Propia | Rentada
  renta_por_ha numeric,
  renta_origen text,       -- propio | linea | externo
  tasa_renta numeric,
  fecha_renta date,
  fecha_pago_renta date,
  renta_disposicion_id uuid,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists insumo (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  nombre text not null,
  unidad text,
  categoria text,
  costo_unitario_ref numeric,
  activo boolean default true,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists inventario_movimiento (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  insumo_id uuid not null references insumo(id),
  tipo text not null,      -- entrada | salida | ajuste
  cantidad numeric not null,
  fecha date not null,
  origen_tipo text,
  origen_id uuid,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists labor (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  parcela_id uuid references parcela(id),
  fecha date not null,
  tipo text,
  descripcion text,
  costo_operacion numeric,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists labor_insumo (
  id uuid primary key,
  organizacion_id uuid references organizacion(id),
  labor_id uuid not null references labor(id),
  insumo_id uuid not null references insumo(id),
  cantidad numeric,
  costo_unitario numeric,
  costo_total numeric,
  eliminado_en timestamptz
);

create table if not exists jornal (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  parcela_id uuid references parcela(id),
  fecha date not null,
  tipo text,
  cuadrilla text,
  actividad text,
  personas numeric,
  dias numeric,
  pago_diario numeric,
  pagado boolean default false,
  fecha_pago date,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists almacenadora (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  nombre text not null,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists boleta (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  parcela_id uuid references parcela(id),
  fecha date not null,
  folio text,
  almacenadora_id uuid references almacenadora(id),
  peso_bruto numeric,
  tara numeric,
  humedad numeric,
  impurezas numeric,
  humedad_std numeric default 14,
  impurezas_std numeric default 2,
  precio_ton numeric,
  trilla numeric,
  flete numeric,
  otros numeric,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists proveedor (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  nombre text not null,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists compra (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  insumo_id uuid references insumo(id),
  insumo_nombre text,
  productor_id uuid references productor(id),
  cantidad numeric,
  unidad text,
  costo_unitario numeric,
  monto numeric,
  fecha date not null,
  origen text,             -- propio | linea | externo
  disposicion_id uuid,
  tasa_externa numeric,
  fecha_pago_externo date,
  solicitud_id uuid,
  proveedor_id uuid references proveedor(id),
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists gasto (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  fecha date not null,
  categoria text,
  descripcion text,
  monto numeric,
  destino text,            -- parcela | prorrateo | general
  parcela_id uuid references parcela(id),
  productor_id uuid references productor(id),
  origen text,
  disposicion_id uuid,
  tasa_externa numeric,
  fecha_pago_externo date,
  origen_caja boolean default false,
  caja_movimiento_id uuid,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists dispersion (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  productor_id uuid references productor(id),
  fecha date not null,
  concepto text,
  monto numeric,
  observacion text,
  origen text,
  disposicion_id uuid,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists prestamo (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  productor_id uuid references productor(id),
  fecha date not null,
  monto numeric,
  origen text,
  nota text,
  fecha_pago date,
  disposicion_id uuid,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists prestamo_aplicacion (
  id uuid primary key,
  organizacion_id uuid references organizacion(id),
  prestamo_id uuid not null references prestamo(id),
  fecha date not null,
  concepto text,
  monto numeric,
  tipo text,               -- productivo | personal
  destino text,            -- parcela | prorrateo
  parcela_id uuid references parcela(id),
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists solicitud_compra (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  fecha date not null,
  solicitante text,
  insumo_id uuid references insumo(id),
  insumo_nombre text,
  unidad text,
  cantidad numeric,
  categoria text,
  motivo text,
  parcela_id uuid references parcela(id),
  estado text,             -- solicitado | cotizado | autorizado | recibido
  cotizacion_elegida_id uuid,
  autorizado_por_texto text,
  fecha_autorizacion date,
  productor_id uuid references productor(id),
  origen text,
  linea_credito_id uuid,
  tasa_externa numeric,
  compra_id uuid,
  fecha_recibido date,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists solicitud_cotizacion (
  id uuid primary key,
  organizacion_id uuid references organizacion(id),
  solicitud_id uuid not null references solicitud_compra(id),
  proveedor_texto text,
  costo_unitario numeric,
  nota text,
  fecha date,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists caja_movimiento (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  tipo text not null,      -- fondeo | salida
  fecha date not null,
  monto numeric,
  concepto text,
  quien text,
  destino text,
  parcela_id uuid references parcela(id),
  comprobante boolean,
  estado text,             -- pendiente | autorizado
  autorizado_por text,
  fecha_autorizacion date,
  gasto_id uuid,
  origen text,
  disposicion_id uuid,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists linea_credito (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  tipo_credito text,
  fuente text,
  monto_autorizado numeric,
  tiie numeric,
  spread numeric,
  comision_pct numeric,
  fega_pct numeric,
  fecha_inicio date,
  fecha_vencimiento date,
  destino text,
  productor_id uuid references productor(id),
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists disposicion (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  ciclo_id uuid references ciclo(id),
  linea_credito_id uuid not null references linea_credito(id),
  origen_tipo text not null,  -- dispersion | prestamo | renta | gasto | compra | fondeo_caja
  origen_id uuid not null,
  monto numeric not null,
  fecha date not null,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists pago_disposicion (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  disposicion_id uuid not null references disposicion(id),
  fecha date not null,
  monto numeric not null,
  nota text,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists usuario_rol (
  id uuid primary key,
  organizacion_id uuid not null references organizacion(id),
  user_id uuid,
  rol text,                -- Dueño | Oficina | Encargado de campo | Consulta
  ve_finanzas boolean,
  creado_en timestamptz,
  eliminado_en timestamptz
);

create table if not exists audit_log (
  id uuid primary key,
  organizacion_id uuid,
  tabla text,
  registro_id uuid,
  accion text,
  payload jsonb,
  creado_en timestamptz default now()
);

-- ========== funciones / vistas (nombres; cuerpos viven en el espejo JS y en Supabase) ==========
-- fn_hoy_mochis()
-- fn_disposicion_interes(corte date)
-- v_inventario_stock
-- v_disposicion_interes          interés a saldos insolutos
-- v_linea_credito_estado         FEGA anualizada por plazo
-- v_boleta
-- v_movimiento_cuenta_productor
-- v_cuenta_productor
--
-- RPCs security definer: ver handoff §4.

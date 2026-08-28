// @ts-nocheck
import { useState, useMemo, useEffect, useRef, Component } from "react";
import {
  LayoutDashboard, Sprout, Tractor, Package, Users, Landmark, BarChart3, Wheat, Wallet,
  Plus, X, AlertTriangle, ChevronRight, Pencil, Trash2, Fuel,
  CheckCircle2, MessageCircle, Copy, Bell, SlidersHorizontal, BookUser, ArrowRightLeft,
  ClipboardList, PackageCheck, Coins, TrendingUp, CalendarClock, Banknote, LogOut, ListTodo
} from "lucide-react";
import { useOrgRead, useOrgWrite } from "./data/useOrgQuery";
import { supabase } from "./lib/supabase";
import { runCanarios } from "./data/canarios";
import { EquipoPanel, RolesPanel, salirAgro, useAgroSession } from "./session";
import { AyudaBoton } from "./Ayuda";
import { Onboarding } from "./Onboarding";
import { navVisible, puedeEscribirModulo, presetMatriz } from "./server/roles";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  C, money, num, hoyStr, diasEntre, diasHasta,
  tasaCredito, interesCredito, plazoDias, fegaCredito, comisionCredito, costoFinCredito,
  interesCompra, interesGasto, costoLabor, rentaMonto, rentaInteres, calcBoleta,
  TEMPORADAS, TIPO_LABEL, TIPO_ENUM, CAT_GASTO, CONCEPTOS_DISPERSION,
  ESTADOS_SOLICITUD, ORDEN_ESTADO, TIPOS_LABOR, ACTIVIDADES_RAYA, CULTIVOS_VALLE,
} from "./base";
import {
  fuente, estiloInput, etiquetaCiclo,
  Tarjeta, Etiqueta, Boton, Campo, PickerParcela, Acciones, ErrorBoundary,
  BarraLista, Seccion, Fila, Vacio, useForm,
} from "./ui";
import { VistaAjustes } from "./vistas/Ajustes";
import { VistaReportes } from "./vistas/VistaReportes";
import { VistaCostoFin } from "./vistas/CostoFin";
import { VistaCredito } from "./vistas/Credito";
import { VistaCaja } from "./vistas/Caja";
import { VistaGastos } from "./vistas/Gastos";
import { VistaProductores } from "./vistas/Productores";
import { VistaCosecha } from "./vistas/Cosecha";
import { VistaSolicitudes } from "./vistas/Solicitudes";
import { VistaRaya } from "./vistas/Raya";
import { VistaInsumos } from "./vistas/Insumos";
import { VistaLabores } from "./vistas/Labores";
import { VistaParcelas } from "./vistas/Parcelas";
import { VistaCiclo } from "./vistas/Ciclo";
import { VistaHoy } from "./vistas/Hoy";
import { Simulador, Reportes } from "./reportes";
import { CanarioBadge, FormCiclo, CiclosAdmin } from "./forms/ciclo";
import {
  FormCredito, FormGasto, FormCajaFondeo, FormCajaSalida,
  ProductorCard, FormProductor, FormDispersion, FormPrestamo, PrestamoCard,
} from "./forms/dinero";
import { FormNomina, FormBoleta } from "./forms/venta";
import {
  CatalogoInsumos, FormInsumo, FormCompra, FormSolicitud, SolicitudCard,
} from "./forms/almacen";
import {
  TareasWhatsApp, FormLabor, FormLaborRapida, FormOrdenLabor,
  PorHacerLabores, GuiaCiclo, FormParcela,
} from "./forms/campo";
import { CampoProductor, CampoFinanciamiento } from "./forms/comunes";

/* ---------- App ---------- */
function AgroCicloApp() {
  const { profile, setCiclo, restaurarDemo, reload, vaciar, guardarAjustes, regenerarCodigo } = useAgroSession();
  const user = useCurrentUser();
  const rol = profile.rol;
  const matriz = profile.permisos && Object.keys(profile.permisos).length ? profile.permisos : presetMatriz(rol);
  const [guia, setGuia] = useState(!profile.onboardingHecho);
  const ORG_ID = profile.orgId;
  const CICLO_ID = profile.cicloId;
  const ciclos = profile.ciclos.length
    ? profile.ciclos
    : [{ id: CICLO_ID, clave: "oi2627", nombre: "Otoño–Invierno 2026/27", fechaInicio: "2026-10-01", fechaFin: "2027-09-30", presupuesto: 0 }];
  const temporadaId = ciclos.find((c) => c.id === CICLO_ID)?.clave || "oi2627";
  const [vista, setVista] = useState(rol === "Encargado de campo" ? "captura" : "panel");
  const nombreCiclo = ciclos.find((c) => c.id === CICLO_ID)?.nombre
    || TEMPORADAS.find((t) => t.id === temporadaId)?.nombre
    || temporadaId;

  // parcelas: leídas de la base (slice migrado). Se construyen como `parcelasT`
  // (DB → id ES el uuid de la parcela) más abajo; `parcelas` es su alias.
  // insumos y labores: leídos de la base (este slice). Se construyen como insumosT/laboresT
  // más abajo; `insumos` es alias de insumosT.
  // nomina (jornal) y boletas: también leídos de la base (slice boletas+nómina); se construyen
  // más abajo (tras los puentes de parcela), justo antes de nominaT/boletasT.
  // CRÉDITOS: última pieza fuera del seed → se lee de la base (creditosQ/creditosT, abajo).
  // compras: ya no es estado en memoria → se lee de la base (comprasQ/comprasT, más abajo).
  // Gastos: los "reales" vienen de la base (gastosDb, definido abajo tras los puentes de parcela).
  // (caja chica migró a la base: ya no hay sidecar de gastos ni estado en memoria de movimientos)
  // Productores: leídos del DB (slice migrado). Mapea tipo enum -> etiqueta del prototipo.
  const productoresQ = useOrgRead(["productores"], "productor", { build: (q) => q.eq("activo", true).order("codigo") });
  const productores = useMemo(
    () => (productoresQ.data ?? []).map((r) => ({ ...r, tipo: TIPO_LABEL[r.tipo] ?? r.tipo })),
    [productoresQ.data]
  );
  const [fechaObjetivo, setFechaObjetivo] = useState(hoyStr);
  const [pagoSupuesto, setPagoSupuesto] = useState({});
  // Pagos parciales: monto del abono por renglón (clave de dispsDeLinea). El input de fecha
  // reusa pagoSupuesto[clave] (capado a hoy); el monto vive aquí.
  const [abonoMonto, setAbonoMonto] = useState({});
  const [form, setForm] = useState(null);
  const cerrar = () => setForm(null);
  // Auto-scroll: en Productores los formularios se abren arriba de la sección;
  // al abrir cualquiera (productor/dispersión/préstamo) llevamos la vista hasta él.
  const formRef = useRef(null);
  useEffect(() => {
    if (form && (form.tipo === "productor" || form.tipo === "dispersion" || form.tipo === "prestamo")) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [form]);

  /* --- roles de sesión (servidor) --- */

  const veFinanzas = profile.veFinanzas;
  const puedeEditar = puedeEscribirModulo(rol, vista, matriz);
  const vePrecios = veFinanzas || profile.encargadoVePrecios;
  // En Hoy el permiso que manda es el de labores (la Oficina tiene captura en
  // "ver" pero sí registra labores); ordenar es de quien lleva los números.
  const puedeLabores = puedeEscribirModulo(rol, "labores", matriz);
  const puedeOrdenar = puedeLabores && veFinanzas;
  // Form corto de Hoy: null cerrado · { orden } al cerrar una orden · { orden: null } labor nueva.
  const [rapida, setRapida] = useState(null);
  // Guía de arranque de El ciclo: "Ocultar" solo vive esta sesión (sin flag en
  // el ledger); al volver a entrar sin captura, reaparece.
  const [guiaCicloOculta, setGuiaCicloOculta] = useState(false);

  // CRÉDITOS (base de datos). Última pieza fuera del seed. linea_credito leída por uuid.
  // B2a: `id` ES EL UUID real (se eliminó el id sintético i+1 y el puente por fuente).
  // `_uuid` se conserva como alias de `id` por compatibilidad con consumidores de escritura.
  // productorId es uuid directo (consistente con parcelas).
  const creditosQ = useOrgRead(["lineas-credito", CICLO_ID], "linea_credito", {
    columns: "id, tipo_credito, fuente, monto_autorizado, tiie, spread, comision_pct, fega_pct, fecha_inicio, fecha_vencimiento, destino, productor_id",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("creado_en", { ascending: true }),
  });
  const creditosT = useMemo(
    () => (creditosQ.data ?? []).map((r) => ({
      id: r.id, _uuid: r.id, temporadaId,    // B2a: id = uuid de la línea
      tipoCredito: r.tipo_credito, fuente: r.fuente,
      monto: Number(r.monto_autorizado) || 0,
      tiie: Number(r.tiie) || 0, spread: Number(r.spread) || 0,
      comision: Number(r.comision_pct) || 0, fega: Number(r.fega_pct) || 0,
      fechaInicio: r.fecha_inicio, fechaVencimiento: r.fecha_vencimiento,
      destino: r.destino, productorId: r.productor_id ?? null,
    })),
    [creditosQ.data, temporadaId]
  );
  // Costo financiero de las LÍNEAS desde la vista (B1): reemplaza el motor JS para el TOTAL.
  // La FEGA ya está anualizada por plazo en la vista → paridad exacta con el JS previo.
  const vistaLineaQ = useOrgRead(["v-linea-estado", CICLO_ID], "v_linea_credito_estado", { build: (q) => q.eq("ciclo_id", CICLO_ID) });
  const cfinLineasVista = useMemo(
    () => (vistaLineaQ.data ?? []).reduce((s, r) => s + Number(r.costo_financiero_total || 0), 0),
    [vistaLineaQ.data]
  );
  /* B2b: congelamiento REAL del interés por disposición, leído de la base.
     v_disposicion_interes expone, por disposición viva: fecha_corte = min(pago_disposicion.fecha)
     (o hoy si no hay pago) y saldada = sum(pagos) >= monto. El freeze del motor JS sale de AQUÍ
     (no de fecha_pago del registro): el motor y la vista leen el MISMO pago_disposicion → coinciden
     por construcción. Mientras no haya pagos, todo cae a null y los números no se mueven. */
  const dispInteresQ = useOrgRead(["disp-interes", CICLO_ID], "v_disposicion_interes", {
    columns: "id, fecha_corte, saldada, interes_devengado, pagado, saldo",
    build: (q) => q.eq("ciclo_id", CICLO_ID),
  });
  /* PAGOS PARCIALES: abonos vivos por disposición (lista para la UI + p_pago_id de revertir-uno).
     pago_disposicion no tiene ciclo_id; en dev hay un solo ciclo, así que leemos todos los vivos de
     la org y los agrupamos por disposición. Misma política RLS que dispersion → lee igual que las demás. */
  const pagosDispQ = useOrgRead(["pagos-disp"], "pago_disposicion", {
    columns: "id, disposicion_id, fecha, monto, nota",
    build: (q) => q.is("eliminado_en", null).order("fecha"),
  });
  const pagosPorDispId = useMemo(() => {
    const m = {};
    (pagosDispQ.data ?? []).forEach(r => {
      (m[r.disposicion_id] ||= []).push({ id: r.id, fecha: r.fecha, monto: Number(r.monto) || 0, nota: r.nota || "" });
    });
    return m;
  }, [pagosDispQ.data]);
  const freezePorDispId = useMemo(
    () => Object.fromEntries((dispInteresQ.data ?? [])
      .map(r => [r.id, {
        fechaCorte: r.fecha_corte ?? null,
        saldada: !!r.saldada,
        pagado: Number(r.pagado) || 0,
        saldo: Number(r.saldo) || 0,
      }])),
    [dispInteresQ.data]
  );
  // fechaPago "real" del renglón: SOLO si la disposición está saldada (congela en fecha_corte).
  const freezeFechaPago = (dispId) => {
    const f = dispId ? freezePorDispId[dispId] : null;
    return (f && f.saldada) ? f.fechaCorte : null;
  };
  /* Campos de congelamiento + abonos que cada renglón de dispsDeLinea lleva consigo.
     saldo = monto − abonado (de la vista); pagos[] = abonos vivos (del read nuevo).
     fechaPago = fecha_corte SOLO si saldada (= freezeFechaPago), para compatibilidad con el motor. */
  const freezeRow = (dispId) => {
    const f = dispId ? freezePorDispId[dispId] : null;
    return {
      saldada: f ? f.saldada : false,
      fechaCorte: f ? f.fechaCorte : null,
      saldo: f ? f.saldo : null,
      pagos: (dispId && pagosPorDispId[dispId]) || [],
      fechaPago: (f && f.saldada) ? f.fechaCorte : null,
    };
  };
  // Badge inline: operación de LÍNEA marcada pagada al productor pero su disposición
  // sigue sin liquidar en la financiera (misma condición que el aviso ámbar del Panel).
  const dispSinLiquidar = (origen, fechaPagoOp, dispId) =>
    origen === "linea" && !!fechaPagoOp && !!dispId
    && !!freezePorDispId[dispId] && !freezePorDispId[dispId].saldada;
  // compras (base) y comprasT: definidos DESPUÉS del puente de insumo (insumo uuid→legacy).
  // gastos (base + sidecar de caja) y gastosT: definidos DESPUÉS de parcelasT/idsParcelasT
  // (gastosDb valida la parcela contra idsParcelasT). Ver más abajo.
  // parcelasT, idsParcelasT, laboresT, nominaT, boletasT: definidos más abajo
  // (PARCELAS migrado: parcelasT viene de la base y su id ES el uuid; sin puente seed↔uuid).

  /* B2a: PUENTE crédito↔fuente ELIMINADO. Las operaciones de línea embeben directo
     `disposicion ( linea_credito_id, eliminado_en )`; el creditoId del front ES el uuid de la
     línea, tomado de disposiciones VIVAS (si la disposición está soft-deleted → creditoId = ""
     y el test de invariante lo caza, en vez de pegarse a una línea muerta). */
  const dispersionesQ = useOrgRead(["dispersiones", CICLO_ID], "dispersion", {
    columns: "id, productor_id, fecha, concepto, monto, observacion, origen, disposicion_id, disposicion ( linea_credito_id, eliminado_en )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha"),
  });
  const dispersionesT = useMemo(
    () => (dispersionesQ.data ?? []).map((d) => {
      // PostgREST suele devolver objeto en relaciones "a-uno"; nos cubrimos por si llega como arreglo.
      const dispo = Array.isArray(d.disposicion) ? d.disposicion[0] : d.disposicion;
      // B2a: uuid directo SOLO de disposición viva (descarta soft-deleted).
      const lineaUuid = (dispo && !dispo.eliminado_en) ? (dispo.linea_credito_id ?? null) : null;
      return {
        id: d.id,
        productorId: d.productor_id,
        fecha: d.fecha,
        concepto: d.concepto,
        monto: Number(d.monto),
        observacion: d.observacion ?? "",
        origen: d.origen,
        creditoId: d.origen === "linea" ? (lineaUuid ?? "") : null,
        lineaUuid,
        disposicionId: d.disposicion_id ?? null,   // B2b: para liquidar/congelar la disposición
      };
    }),
    [dispersionesQ.data]
  );
  /* PARCELAS (base de datos). MIGRADO a uuid directo: el `id` del front ES el uuid de la parcela
     (igual que créditos y productores). Labores/boletas/nómina/gastos/aplicaciones y costo/ha casan
     por uuid; sin puente seed↔numérico. `_uuid` se conserva = id por compatibilidad con las
     escrituras que ya leían `original._uuid` / `p._uuid`. B2a: la renta de LÍNEA trae su línea por
     uuid directo (disposicion → linea_credito_id de disposición viva), para dispsDeLinea.
     `parcelas` es alias de parcelasT: todo consumidor del array seed sigue igual (ahora con id uuid). */
  const parcelasQ = useOrgRead(["parcelas", CICLO_ID], "parcela", {
    columns:
      "id, nombre, cultivo, ha, rend_esperado, precio_esperado, tenencia, renta_por_ha, renta_origen, tasa_renta, fecha_renta, fecha_pago_renta, productor_id, renta_disposicion_id, disposicion!parcela_renta_disposicion_id_fkey ( linea_credito_id, eliminado_en )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("creado_en"),
  });
  const parcelasT = useMemo(() => {
    return (parcelasQ.data ?? []).map((r) => {
      const dispo = Array.isArray(r.disposicion) ? r.disposicion[0] : r.disposicion;
      const lineaUuid = (dispo && !dispo.eliminado_en) ? (dispo.linea_credito_id ?? null) : null;
      return {
        id: r.id,        // uuid directo (PARCELAS migrado)
        _uuid: r.id,
        temporadaId,
        nombre: r.nombre,
        cultivo: r.cultivo,
        ha: Number(r.ha) || 0,
        rendEsperado: r.rend_esperado != null ? Number(r.rend_esperado) : 0,
        precioEsperado: r.precio_esperado != null ? Number(r.precio_esperado) : 0,
        tenencia: r.tenencia,
        rentaPorHa: r.renta_por_ha != null ? Number(r.renta_por_ha) : 0,
        rentaOrigen: r.renta_origen ?? null,
        rentaCreditoId: r.renta_origen === "linea" ? (lineaUuid ?? "") : null,
        rentaLineaUuid: lineaUuid,
        tasaRenta: r.tasa_renta != null ? Number(r.tasa_renta) : 0,
        fechaRenta: r.fecha_renta ?? null,
        fechaPagoRenta: r.fecha_pago_renta ?? null,
        disposicionId: r.renta_disposicion_id ?? null,   // B2b: la disposición de la renta de línea
        productorId: r.productor_id, // uuid
      };
    });
  }, [parcelasQ.data, temporadaId]);
  const parcelas = parcelasT; // alias: todo consumidor del array seed sigue funcionando
  const idsParcelasT = useMemo(() => new Set(parcelasT.map(p => p.id)), [parcelasT]); // set de uuids de parcela del ciclo

  /* INSUMOS (base de datos). Catálogo de `insumo` + stock de la vista `v_inventario_stock`.
     id = uuid directo (slice INSUMOS: puente seed↔uuid eliminado). Se conserva `_uuid = id` por
     compatibilidad con las escrituras que ya leían `ins._uuid`. El almacén ordena por NOMBRE
     (localeCompare "es") — antes ordenaba por id numérico, que con uuid ya no aplica.
     `insumos` es alias de insumosT. */
  const insumosCatQ = useOrgRead(["insumos"], "insumo", { build: (q) => q.eq("activo", true) });
  const stockQ = useOrgRead(["inventario-stock", CICLO_ID], "v_inventario_stock", {
    build: (q) => q.eq("ciclo_id", CICLO_ID),
  });
  const movInvQ = useOrgRead(["inventario-mov", CICLO_ID], "inventario_movimiento", {
    columns: "id, fecha, tipo, cantidad, insumo_id, origen_tipo, origen_id, insumo ( nombre, unidad, categoria )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha", { ascending: false }),
  });
  const insumosT = useMemo(() => {
    const stockPorUuid = Object.fromEntries((stockQ.data ?? []).map(s => [s.insumo_id, Number(s.stock) || 0]));
    return (insumosCatQ.data ?? [])
      .map(r => ({
        id: r.id,        // uuid directo
        _uuid: r.id,     // = id (compatibilidad con escrituras que leen ins._uuid)
        nombre: r.nombre,
        unidad: r.unidad,
        categoria: r.categoria,
        costoUnitario: r.costo_unitario_ref != null ? Number(r.costo_unitario_ref) : 0,
        stock: stockPorUuid[r.id] ?? 0,
        activo: r.activo,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")); // orden alfabético en el almacén
  }, [insumosCatQ.data, stockQ.data]);
  const insumos = insumosT; // alias: todo consumidor del array seed sigue funcionando
  const insumosAlmacen = useMemo(() => {
    const ids = new Set((stockQ.data ?? []).map((s) => s.insumo_id));
    return insumosT.filter((ins) => ids.has(ins.id));
  }, [insumosT, stockQ.data]);

  /* LABORES (base de datos). labor + labor_insumo (con su insumo para detectar el diésel).
     parcela e insumo por uuid directo (slice INSUMOS: puente eliminado); la
     línea de diésel → litrosDiesel/costoDiesel, la línea normal → insumoId/cantidad/costoInsumo.
     Así costoLabor, costo/ha, la lista y FormLabor siguen igual. `id`/`_uuid` = uuid de la labor.
     Se filtran las labores cuya parcela no está en parcelasT (otro ciclo / dada de baja). */
  const laboresQ = useOrgRead(["labores", CICLO_ID], "labor", {
    columns: "id, parcela_id, fecha, tipo, descripcion, costo_operacion, labor_insumo ( insumo_id, cantidad, costo_unitario, costo_total, insumo ( categoria ) )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha"),
  });
  const laboresT = useMemo(() => {
    return (laboresQ.data ?? []).map(r => {
      if (!idsParcelasT.has(r.parcela_id)) return null;   // descarta parcelas de otro ciclo / dadas de baja
      const lineas = r.labor_insumo ?? [];
      const catDe = (li) => { const ins = Array.isArray(li.insumo) ? li.insumo[0] : li.insumo; return ins?.categoria; };
      const lDiesel = lineas.find(li => catDe(li) === "Diésel");
      const lOtra = lineas.find(li => catDe(li) !== "Diésel");
      return {
        id: r.id, _uuid: r.id,
        parcelaId: r.parcela_id,
        fecha: r.fecha, tipo: r.tipo, desc: r.descripcion ?? "",
        costoOp: Number(r.costo_operacion) || 0,
        insumoId: lOtra ? (lOtra.insumo_id ?? null) : null,   // uuid directo
        cantidad: lOtra ? Number(lOtra.cantidad) : null,
        costoInsumo: lOtra ? Number(lOtra.costo_total) : 0,
        litrosDiesel: lDiesel ? Number(lDiesel.cantidad) : null,
        costoDiesel: lDiesel ? Number(lDiesel.costo_total) : 0,
        pendiente: r.estado === "pendiente",
        planInsumoId: r.plan_insumo_id ?? null,
        planCantidad: Number(r.plan_cantidad) || 0,
        planLitrosDiesel: Number(r.plan_litros_diesel) || 0,
      };
    }).filter(Boolean);
  }, [laboresQ.data, idsParcelasT]);
  /* Orden flaca: labor con estado='pendiente' (anotada, sin costo ni bodega).
     Las hechas son la verdad de costos; las pendientes solo salen en "Por hacer". */
  const ordenesLabor = useMemo(() => laboresT.filter(l => l.pendiente), [laboresT]);
  const laboresHechas = useMemo(() => laboresT.filter(l => !l.pendiente), [laboresT]);
  /* NÓMINA (base de datos). jornal del ciclo, traducido a la forma del prototipo: parcela
     por uuid directo, `pago_diario`→`pago`.
     `id`/`_uuid` = uuid del jornal. Se filtran los jornales cuya parcela no está en parcelasT.
     `seedNomina` quedó eliminado. */
  const nominaQ = useOrgRead(["nomina", CICLO_ID], "jornal", {
    columns: "id, parcela_id, fecha, tipo, cuadrilla, actividad, personas, dias, pago_diario, pagado, fecha_pago",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha"),
  });
  const nomina = useMemo(() => {
    return (nominaQ.data ?? []).map(r => {
      if (!idsParcelasT.has(r.parcela_id)) return null;
      return {
        id: r.id, _uuid: r.id,
        parcelaId: r.parcela_id,
        fecha: r.fecha, tipo: r.tipo, cuadrilla: r.cuadrilla ?? "", actividad: r.actividad ?? "",
        personas: Number(r.personas) || 0, dias: Number(r.dias) || 0,
        pago: Number(r.pago_diario) || 0,
        pagado: !!r.pagado, fechaPago: r.fecha_pago ?? null,
      };
    }).filter(Boolean);
  }, [nominaQ.data, idsParcelasT]);

  /* BOLETAS (base de datos). boleta embebiendo almacenadora(nombre)→`bodega` (texto del form),
     folio→`boleta`. parcela por uuid directo. Se conserva `calcBoleta`
     (JS) para la pantalla, el FormBoleta y el costo/ha — v_boleta sigue siendo la verdad del
     estado de cuenta (ya cableado). `id`/`_uuid` = uuid de la boleta. `seedBoletas` eliminado. */
  const boletasQ = useOrgRead(["boletas", CICLO_ID], "boleta", {
    columns: "id, parcela_id, fecha, folio, peso_bruto, tara, humedad, impurezas, humedad_std, impurezas_std, precio_ton, trilla, flete, otros, almacenadora ( nombre )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha"),
  });
  const boletas = useMemo(() => {
    return (boletasQ.data ?? []).map(r => {
      if (!idsParcelasT.has(r.parcela_id)) return null;
      const alm = Array.isArray(r.almacenadora) ? r.almacenadora[0] : r.almacenadora;
      return {
        id: r.id, _uuid: r.id,
        parcelaId: r.parcela_id,
        fecha: r.fecha,
        bodega: alm?.nombre ?? "",
        boleta: r.folio ?? "",
        pesoBruto: Number(r.peso_bruto) || 0,
        tara: Number(r.tara) || 0,
        humedad: Number(r.humedad) || 0,
        impurezas: Number(r.impurezas) || 0,
        hStd: r.humedad_std != null ? Number(r.humedad_std) : 14,
        iStd: r.impurezas_std != null ? Number(r.impurezas_std) : 2,
        precioTon: Number(r.precio_ton) || 0,
        trilla: Number(r.trilla) || 0,
        flete: Number(r.flete) || 0,
        otros: Number(r.otros) || 0,
      };
    }).filter(Boolean);
  }, [boletasQ.data, idsParcelasT]);

  const nominaT = useMemo(() => nomina.filter(n => idsParcelasT.has(n.parcelaId)), [nomina, idsParcelasT]);
  const boletasT = useMemo(() => boletas.filter(b => idsParcelasT.has(b.parcelaId)), [boletas, idsParcelasT]);

  /* GASTOS (base de datos). Se leen TODOS los gastos vivos: los 4 "reales" + el de Caja chica
     (origen_caja=true), que ya vive en la base con su caja_movimiento_id. Sin sidecar → un solo
     $1,850 en el costo/ha. Se embebe disposicion(linea_credito_id, eliminado_en) para ligar el gasto de
     línea a su crédito por uuid directo (igual que dispersiones/préstamos) → dispsDeLinea lo cuenta
     una sola vez y el Costo financiero queda en paridad. parcela por uuid directo. El gasto externo
     lee tasa_externa/fecha_pago_externo. El de caja es origen='propio' (sin interés). */
  const gastosQ = useOrgRead(["gastos", CICLO_ID], "gasto", {
    columns: "id, fecha, categoria, descripcion, monto, destino, parcela_id, productor_id, origen, disposicion_id, tasa_externa, fecha_pago_externo, origen_caja, caja_movimiento_id, disposicion ( linea_credito_id, eliminado_en )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha"),
  });
  const gastosDb = useMemo(
    () => (gastosQ.data ?? []).map((r) => {
      const dispo = Array.isArray(r.disposicion) ? r.disposicion[0] : r.disposicion;
      const lineaUuid = (dispo && !dispo.eliminado_en) ? (dispo.linea_credito_id ?? null) : null;
      return {
        id: r.id, _uuid: r.id,
        temporadaId,
        fecha: r.fecha,
        categoria: r.categoria,
        desc: r.descripcion ?? "",
        monto: Number(r.monto) || 0,
        destino: r.destino,
        parcelaId: r.destino === "parcela" ? (idsParcelasT.has(r.parcela_id) ? r.parcela_id : null) : null,
        productorId: r.productor_id ?? null,          // uuid (productores ya migrado)
        origen: r.origen,
        creditoId: r.origen === "linea" ? (lineaUuid ?? "") : null,
        lineaUuid,
        tasa: r.origen === "externo" ? (Number(r.tasa_externa) || 0) : 0,
        fechaPago: r.origen === "externo" ? (r.fecha_pago_externo ?? null) : null,
        disposicionId: r.disposicion_id ?? null,   // B2b
        origenCaja: !!r.origen_caja,
        cajaMovId: r.caja_movimiento_id ?? null,
      };
    }),
    [gastosQ.data, idsParcelasT, temporadaId]
  );

  /* COMPRAS (base de datos). compra + embeds insumo(nombre), proveedor(nombre) y
     disposicion(linea_credito_id, eliminado_en). insumo por uuid directo (slice INSUMOS: puente
     eliminado); el nombre sale del embed insumo(nombre)/insumo_nombre. B2a: la compra de línea trae su
     crédito por uuid directo (disposición viva) → dispsDeLinea la cuenta una sola vez; la externa lee
     tasa_externa/fecha_pago_externo (su propio interés). `productorId` queda en uuid (productores ya
     migrado). `id`/`_uuid` = uuid de la compra. Mapeo defensivo de embeds (objeto o arreglo). */
  const comprasQ = useOrgRead(["compras", CICLO_ID], "compra", {
    columns: "id, insumo_id, insumo_nombre, productor_id, cantidad, unidad, costo_unitario, monto, fecha, origen, disposicion_id, tasa_externa, fecha_pago_externo, solicitud_id, insumo ( nombre ), proveedor ( nombre ), disposicion ( linea_credito_id, eliminado_en )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha"),
  });
  const comprasT = useMemo(
    () => (comprasQ.data ?? []).map((r) => {
      const dispo = Array.isArray(r.disposicion) ? r.disposicion[0] : r.disposicion;
      const lineaUuid = (dispo && !dispo.eliminado_en) ? (dispo.linea_credito_id ?? null) : null;
      const ins = Array.isArray(r.insumo) ? r.insumo[0] : r.insumo;
      const prov = Array.isArray(r.proveedor) ? r.proveedor[0] : r.proveedor;
      return {
        id: r.id, _uuid: r.id,
        temporadaId,
        insumoId: r.insumo_id ?? null,   // uuid directo
        insumoNombre: ins?.nombre ?? r.insumo_nombre ?? "",
        cantidad: Number(r.cantidad) || 0,
        unidad: r.unidad ?? "",
        costoUnitario: Number(r.costo_unitario) || 0,
        monto: Number(r.monto) || 0,
        fecha: r.fecha,
        origen: r.origen,
        creditoId: r.origen === "linea" ? (lineaUuid ?? "") : null,
        lineaUuid,
        tasa: r.origen === "externo" ? (Number(r.tasa_externa) || 0) : 0,
        fechaPago: r.origen === "externo" ? (r.fecha_pago_externo ?? null) : null,
        disposicionId: r.disposicion_id ?? null,   // B2b
        proveedor: prov?.nombre ?? "",
        productorId: r.productor_id ?? null,   // uuid
        solicitudId: r.solicitud_id ?? null,
      };
    }),
    [comprasQ.data, temporadaId]
  );
  // Gastos: TODOS desde la base (los 4 reales + el de caja chica con origen_caja=true).
  // Sidecar eliminado → el $1,850 de caja se cuenta UNA sola vez en el costo/ha.
  const gastos = gastosDb;
  const gastosT = useMemo(() => gastos.filter(g => g.temporadaId === temporadaId), [gastos, temporadaId]);

  /* Préstamos: leídos de la base. Igual que dispersiones, se trae la FUENTE de la línea
     (vía disposicion → linea_credito_id de disposición viva) para ligar al crédito por uuid; así
     dispsDeLinea sigue casando por creditoId numérico sin tocarse. Las aplicaciones
     vienen embebidas; se filtran las eliminadas y su parcela queda en uuid directo. */
  const prestamosQ = useOrgRead(["prestamos", CICLO_ID], "prestamo", {
    columns: "id, productor_id, fecha, monto, origen, nota, fecha_pago, disposicion_id, disposicion ( linea_credito_id, eliminado_en ), prestamo_aplicacion ( id, fecha, concepto, monto, tipo, destino, parcela_id, eliminado_en )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha"),
  });
  const prestamosT = useMemo(
    () => (prestamosQ.data ?? []).map((r) => {
      const dispo = Array.isArray(r.disposicion) ? r.disposicion[0] : r.disposicion;
      const lineaUuid = (dispo && !dispo.eliminado_en) ? (dispo.linea_credito_id ?? null) : null;
      return {
        id: r.id,
        productorId: r.productor_id,
        fecha: r.fecha,
        monto: Number(r.monto),
        origen: r.origen,
        creditoId: r.origen === "linea" ? (lineaUuid ?? "") : null,
        lineaUuid,
        disposicionId: r.disposicion_id ?? null,   // B2b
        nota: r.nota ?? "",
        fechaPago: r.fecha_pago ?? null,
        aplicaciones: (r.prestamo_aplicacion ?? [])
          .filter((a) => !a.eliminado_en)
          .map((a) => ({
            id: a.id,
            fecha: a.fecha,
            concepto: a.concepto,
            monto: Number(a.monto),
            tipo: a.tipo,
            destino: a.destino,
            parcelaId: a.destino === "parcela" ? (a.parcela_id ?? null) : null,
          })),
      };
    }),
    [prestamosQ.data]
  );
  /* Aplicaciones productivas de préstamos: cuentan al costo del cultivo (prorrateo o parcela).
     Las personales NO: solo viven en la cuenta del productor. */
  const apsProductivas = useMemo(() =>
    prestamosT.flatMap(pr => (pr.aplicaciones || []).filter(a => a.tipo === "productivo").map(a => ({ ...a, prestamoId: pr.id }))),
    [prestamosT]);
  /* SOLICITUDES DE COMPRA (base de datos · slice SOLICITUDES). Lee solicitud_compra
     (no eliminadas, ciclo actual) embebiendo solicitud_cotizacion. Mapea a la forma
     del front: creditoId ← linea_credito_id, autorizadoPor ← autorizado_por_texto,
     tasa ← tasa_externa, compraId ← compra_id. Las cotizaciones se ordenan (fecha asc,
     costo desc) para reproducir el orden del seed (148 antes que 139 en Herbicida). */
  const solicitudesQ = useOrgRead(["solicitudes", CICLO_ID], "solicitud_compra", {
    columns: "id, fecha, solicitante, insumo_id, insumo_nombre, unidad, cantidad, categoria, motivo, parcela_id, estado, cotizacion_elegida_id, autorizado_por_texto, fecha_autorizacion, productor_id, origen, linea_credito_id, tasa_externa, compra_id, fecha_recibido, solicitud_cotizacion ( id, proveedor_texto, costo_unitario, nota, fecha )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha", { ascending: false }),
  });
  const solicitudesT = useMemo(
    () => (solicitudesQ.data ?? []).map((r) => ({
      id: r.id,
      temporadaId,
      fecha: r.fecha,
      solicitante: r.solicitante || "",
      insumoId: r.insumo_id ?? null,
      insumoNombre: r.insumo_nombre || "",
      unidad: r.unidad || "",
      cantidad: Number(r.cantidad) || 0,
      categoria: r.categoria || "Otro",
      motivo: r.motivo || "",
      parcelaId: r.parcela_id ?? null,
      estado: r.estado,
      cotizaciones: (Array.isArray(r.solicitud_cotizacion) ? r.solicitud_cotizacion : [])
        .map((c) => ({ id: c.id, proveedor: c.proveedor_texto || "", costoUnitario: Number(c.costo_unitario) || 0, nota: c.nota || "", fecha: c.fecha }))
        .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || b.costoUnitario - a.costoUnitario),
      cotizacionElegidaId: r.cotizacion_elegida_id ?? null,
      autorizadoPor: r.autorizado_por_texto ?? null,
      fechaAutorizacion: r.fecha_autorizacion ?? null,
      productorId: r.productor_id ?? null,
      origen: r.origen ?? null,
      creditoId: r.linea_credito_id ?? null,
      tasa: Number(r.tasa_externa) || 0,
      fechaRecibido: r.fecha_recibido ?? null,
      compraId: r.compra_id ?? null,
    })),
    [solicitudesQ.data, temporadaId]
  );
  /* CAJA CHICA (base de datos). caja_movimiento + embed disposicion(linea_credito_id, eliminado_en) para
     ligar el fondeo de línea a su crédito por uuid directo (igual que compras/gastos) → dispsDeLinea
     lo cuenta. parcela por uuid directo para las salidas a parcela. El gasto de la salida autorizada
     se lee aparte (gastosDb, origen_caja=true). El fondeo expone `nota` (=concepto) y la salida
     `concepto`. `seedCajaMovs` eliminado. */
  const cajaMovsQ = useOrgRead(["caja-movs", CICLO_ID], "caja_movimiento", {
    columns: "id, tipo, fecha, monto, concepto, quien, destino, parcela_id, comprobante, estado, autorizado_por, fecha_autorizacion, gasto_id, origen, disposicion_id, disposicion ( linea_credito_id, eliminado_en )",
    build: (q) => q.eq("ciclo_id", CICLO_ID).is("eliminado_en", null).order("fecha"),
  });
  const cajaMovsT = useMemo(
    () => (cajaMovsQ.data ?? []).map((r) => {
      const dispo = Array.isArray(r.disposicion) ? r.disposicion[0] : r.disposicion;
      const lineaUuid = (dispo && !dispo.eliminado_en) ? (dispo.linea_credito_id ?? null) : null;
      const esFondeo = r.tipo === "fondeo";
      return {
        id: r.id, _uuid: r.id,
        temporadaId,
        tipo: r.tipo,
        fecha: r.fecha,
        monto: Number(r.monto) || 0,
        concepto: r.concepto ?? "",
        nota: esFondeo ? (r.concepto ?? "") : "",
        quien: r.quien ?? "",
        destino: r.destino,
        parcelaId: r.destino === "parcela" ? (idsParcelasT.has(r.parcela_id) ? r.parcela_id : null) : null,
        comprobante: !!r.comprobante,
        estado: r.estado,
        autorizadoPor: r.autorizado_por ?? null,
        fechaAutorizacion: r.fecha_autorizacion ?? null,
        gastoId: r.gasto_id ?? null,
        origen: esFondeo ? (r.origen ?? "propio") : null,
        creditoId: (esFondeo && r.origen === "linea") ? (lineaUuid ?? "") : null,
        lineaUuid: esFondeo ? lineaUuid : null,
        disposicionId: esFondeo ? (r.disposicion_id ?? null) : null,   // B2b
      };
    }),
    [cajaMovsQ.data, idsParcelasT, temporadaId]
  );

  // Cuenta del productor POR CICLO: totales/saldo de v_cuenta_productor + ledger de
  // v_movimiento_cuenta_productor. Default 0 para quien no tuvo movimiento en el ciclo.
  const cuentaQ = useOrgRead(["cuenta-productor", CICLO_ID], "v_cuenta_productor", { build: (q) => q.eq("ciclo_id", CICLO_ID) });
  const movQ = useOrgRead(["mov-cuenta-productor", CICLO_ID], "v_movimiento_cuenta_productor", { build: (q) => q.eq("ciclo_id", CICLO_ID) });
  const cuentasProductor = useMemo(() => {
    const map = {};
    productores.forEach(pr => { map[pr.id] = { cargos: [], abonos: [], totalCargos: 0, totalAbonos: 0, saldo: 0 }; });
    (cuentaQ.data ?? []).forEach(r => {
      const c = map[r.productor_id] || (map[r.productor_id] = { cargos: [], abonos: [], totalCargos: 0, totalAbonos: 0, saldo: 0 });
      c.totalCargos = Number(r.total_cargos);
      c.totalAbonos = Number(r.total_abonos);
      c.saldo = Number(r.saldo);
    });
    (movQ.data ?? []).forEach((m, i) => {
      const c = map[m.productor_id]; if (!c) return;
      const mov = { id: m.origen + "-" + m.fecha + "-" + i, origenId: m.origen_id, fecha: m.fecha, origen: m.origen, desc: m.desc_mov, monto: Number(m.monto) };
      (m.tipo === "cargo" ? c.cargos : c.abonos).push(mov);
    });
    Object.values(map).forEach(c => {
      c.cargos.sort((a, b) => a.fecha.localeCompare(b.fecha));
      c.abonos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    });
    return map;
  }, [productores, cuentaQ.data, movQ.data]);

  const grupoCargos = Object.values(cuentasProductor).reduce((s, c) => s + c.totalCargos, 0);
  const grupoAbonos = Object.values(cuentasProductor).reduce((s, c) => s + c.totalAbonos, 0);

  /* --- cálculos centrales --- */
  const haTotal = parcelasT.reduce((s, p) => s + p.ha, 0);

  /* --- motor de interés por disposición (avío revolvente) ---
     Cada disposición que cuelga de una línea (compra, gasto, renta, fondeo de caja o dispersión)
     devenga interés desde SU propia fecha, no sobre el monto autorizado desde el día uno.
     La FEGA y la comisión siguen sobre el monto autorizado (cobros de apertura/garantía). */
  const dispsDeLinea = (crId) => {
    const out = [];
    // B2a: crId es el uuid de la línea; igualdad por uuid directo (sin Number).
    // B2b: cada renglón lleva su disposicionId; el fechaPago "real" sale del freeze de la base
    //      (pago_disposicion vía v_disposicion_interes), no de la fecha_pago del registro.
    comprasT.filter(c => c.origen === "linea" && c.creditoId === crId)
      .forEach(c => out.push({ clave: "compra-" + c.id, tipo: "Compra", ref: c.insumoNombre || c.proveedor || "Insumo", monto: c.monto, fecha: c.fecha, disposicionId: c.disposicionId || null, ...freezeRow(c.disposicionId) }));
    gastosT.filter(g => g.origen === "linea" && g.creditoId === crId)
      .forEach(g => out.push({ clave: "gasto-" + g.id, tipo: "Gasto", ref: g.desc || g.categoria || "Gasto", monto: g.monto, fecha: g.fecha, disposicionId: g.disposicionId || null, ...freezeRow(g.disposicionId) }));
    parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "linea" && p.rentaCreditoId === crId)
      .forEach(p => out.push({ clave: "renta-" + p.id, tipo: "Renta", ref: p.nombre, monto: rentaMonto(p), fecha: p.fechaRenta || hoyStr, disposicionId: p.disposicionId || null, ...freezeRow(p.disposicionId) }));
    cajaMovsT.filter(m => m.tipo === "fondeo" && m.origen === "linea" && m.creditoId === crId)
      .forEach(m => out.push({ clave: "fondeo-" + m.id, tipo: "Fondeo caja", ref: m.nota || "Fondeo de caja", monto: m.monto, fecha: m.fecha, disposicionId: m.disposicionId || null, ...freezeRow(m.disposicionId) }));
    dispersionesT.filter(d => d.origen === "linea" && d.creditoId === crId)
      .forEach(d => { const pr = productores.find(x => x.id === d.productorId); out.push({ clave: "disp-" + d.id, tipo: "Dispersión", ref: (pr ? pr.codigo + " · " : "") + d.concepto, monto: d.monto, fecha: d.fecha, disposicionId: d.disposicionId || null, ...freezeRow(d.disposicionId) }); });
    prestamosT.filter(pp => pp.origen === "linea" && pp.creditoId === crId)
      .forEach(pp => { const pr = productores.find(x => x.id === pp.productorId); out.push({ clave: "prestamo-" + pp.id, tipo: "Préstamo", ref: (pr ? pr.codigo + " · " : "") + "préstamo en efectivo", monto: pp.monto, fecha: pp.fecha, disposicionId: pp.disposicionId || null, ...freezeRow(pp.disposicionId) }); });
    return out.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  };
  // Interés simple (externos: crédito de proveedor / financiamiento aparte; sin abonos parciales).
  const interesDisp = (monto, fecha, tasaAnual, fechaCorte) => monto * (tasaAnual / 100 / 365) * Math.max(0, diasEntre(fecha, fechaCorte));
  /* PAGOS PARCIALES — interés a SALDOS INSOLUTOS, espejo exacto de v_disposicion_interes / fn_disposicion_interes:
       interés = r × max(0, monto×(corte−fecha) − Σ abono×(corte−fechaAbono))   [abonos con fecha ≤ corte]
     diasEntre(a,b) ya clampa los términos negativos a 0, igual que el GREATEST(0,…) del SQL → paridad por construcción.
     El abono baja CAPITAL completo; el interés es costo paralelo (no se netea del abono ni se capitaliza). */
  const interesInsoluto = (monto, fecha, tasaAnual, corte, pagos) => {
    const baseCapital = monto * diasEntre(fecha, corte);
    const credito = (pagos || []).reduce((s, p) => s + p.monto * diasEntre(p.fecha, corte), 0);
    return (tasaAnual / 100 / 365) * Math.max(0, baseCapital - credito);
  };
  // Interés de un renglón de línea: corte = ult_pago si está saldada (congelado), si no el corte pasado.
  const interesDispLinea = (d, tasaAnual, corteGlobal) =>
    interesInsoluto(d.monto, d.fecha, tasaAnual, d.saldada ? d.fechaCorte : corteGlobal, d.pagos);
  const interesLineaA = (cr, fechaCorte) =>
    dispsDeLinea(cr.id).reduce((s, d) => s + interesDispLinea(d, tasaCredito(cr), fechaCorte), 0);
  const dispuestoLinea = (cr) => dispsDeLinea(cr.id).reduce((s, d) => s + d.monto, 0);
  // Saldo insoluto de la línea: suma de saldos (monto − abonado), NO el todo-o-nada de antes.
  const dispuestoNoPagadoLinea = (cr) => dispsDeLinea(cr.id).reduce((s, d) => s + (d.saldo != null ? d.saldo : d.monto), 0);
  const costoFinLineaA = (cr, fechaCorte) => interesLineaA(cr, fechaCorte) + fegaCredito(cr) + comisionCredito(cr);

  const costoFinCreditos = cfinLineasVista;  // B1: total de líneas desde v_linea_credito_estado (no del motor JS)
  const interesComprasTot = comprasT.reduce((s, c) => s + interesCompra(c), 0);
  const interesGastosTot = gastosT.reduce((s, g) => s + interesGasto(g), 0);
  const rentaIntTotal = parcelasT.reduce((s, p) => s + rentaInteres(p), 0);
  const costoFinGeneral = costoFinCreditos + interesComprasTot + interesGastosTot;
  const costoFinTotal = costoFinGeneral + rentaIntTotal;
  const costoFinPorHa = haTotal > 0 ? costoFinGeneral / haTotal : 0;
  const rentaTotal = parcelasT.reduce((s, p) => s + rentaMonto(p), 0);
  const dieselUsado = laboresT.reduce((s, l) => s + (l.litrosDiesel || 0), 0);
  const dieselCosto = laboresT.reduce((s, l) => s + (l.costoDiesel || 0), 0);
  const rayaPendiente = nominaT.filter(n => !n.pagado).reduce((s, n) => s + n.personas * n.dias * n.pago, 0);
  const cajaFondeado = cajaMovsT.filter(m => m.tipo === "fondeo").reduce((s, m) => s + m.monto, 0);
  const cajaGastado = cajaMovsT.filter(m => m.tipo === "salida").reduce((s, m) => s + m.monto, 0);
  const cajaSaldo = cajaFondeado - cajaGastado;
  const cajaPorAutorizar = cajaMovsT.filter(m => m.tipo === "salida" && m.estado === "pendiente").reduce((s, m) => s + m.monto, 0);

  /* gastos indirectos */
  const apsProductivasTotal = apsProductivas.reduce((s, a) => s + a.monto, 0);
  const apsProrrateo = apsProductivas.filter(a => a.destino !== "parcela").reduce((s, a) => s + a.monto, 0);
  const gastosProrrateo = gastosT.filter(g => g.destino === "prorrateo").reduce((s, g) => s + g.monto, 0) + apsProrrateo;
  const gastosGenerales = gastosT.filter(g => g.destino === "general").reduce((s, g) => s + g.monto, 0);
  const gastosIndPorHa = haTotal > 0 ? gastosProrrateo / haTotal : 0;
  const gastosIndTotal = gastosT.reduce((s, g) => s + g.monto, 0) + apsProductivasTotal;

  const costosParcela = useMemo(() => {
    const map = {};
    parcelasT.forEach(p => {
      const cl = laboresT.filter(l => l.parcelaId === p.id).reduce((s, l) => s + costoLabor(l), 0);
      const cn = nominaT.filter(n => n.parcelaId === p.id).reduce((s, n) => s + n.personas * n.dias * n.pago, 0);
      const renta = rentaMonto(p);
      const gastoDirecto = gastosT.filter(g => g.destino === "parcela" && g.parcelaId === p.id).reduce((s, g) => s + g.monto, 0)
        + apsProductivas.filter(a => a.destino === "parcela" && a.parcelaId === p.id).reduce((s, a) => s + a.monto, 0);
      const gastoInd = gastoDirecto + gastosIndPorHa * p.ha;
      const ci = costoFinPorHa * p.ha + rentaInteres(p);
      const directo = cl + cn + renta;
      const total = directo + gastoInd + ci; // costo completo
      const ingreso = p.ha * p.rendEsperado * p.precioEsperado;
      const bols = boletasT.filter(b => b.parcelaId === p.id).map(calcBoleta);
      const tonReal = bols.reduce((s, b) => s + b.ton, 0);
      const ingresoReal = bols.reduce((s, b) => s + b.ingresoNeto, 0);
      map[p.id] = {
        labores: cl, nomina: cn, renta, gastoInd, interes: ci, directo, total,
        porHa: p.ha ? total / p.ha : 0,
        directoPorHa: p.ha ? directo / p.ha : 0,
        ingreso, utilidad: ingreso - total,
        puntoEq: p.precioEsperado > 0 && p.ha > 0 ? (total / p.ha) / p.precioEsperado : 0,
        precioEq: p.rendEsperado > 0 && p.ha > 0 ? (total / p.ha) / p.rendEsperado : 0,
        tonReal, ingresoReal, rendReal: p.ha ? tonReal / p.ha : 0,
        utilidadReal: ingresoReal - total,
      };
    });
    return map;
  }, [parcelasT, laboresT, nominaT, costoFinPorHa, boletasT, gastosT, gastosIndPorHa, apsProductivas]);

  const costoDirectoTotal = Object.values(costosParcela).reduce((s, c) => s + c.directo, 0);
  const inversionTotal = costoDirectoTotal + gastosIndTotal + costoFinTotal;
  const ingresoTotal = Object.values(costosParcela).reduce((s, c) => s + c.ingreso, 0);
  const ingresoRealTotal = Object.values(costosParcela).reduce((s, c) => s + c.ingresoReal, 0);
  const deudaViva = creditosT.reduce((s, c) => s + dispuestoNoPagadoLinea(c), 0)
    + comprasT.filter(c => c.origen === "externo" && !c.fechaPago).reduce((s, c) => s + c.monto, 0)
    + parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo" && !p.fechaPagoRenta).reduce((s, p) => s + rentaMonto(p), 0);

  /* --- avisos --- */
  const avisos = useMemo(() => {
    const a = [];
    creditosT.forEach(cr => {
      if (!cr.fechaVencimiento) return;
      const d = diasHasta(cr.fechaVencimiento);
      if (d < 0) a.push({ nivel: "rojo", ambito: "fin", texto: `El crédito de ${cr.fuente} VENCIÓ hace ${Math.abs(d)} días (${cr.fechaVencimiento}). Revisa moratorios con tu intermediario.` });
      else if (d <= 60) a.push({ nivel: "ambar", ambito: "fin", texto: `El crédito de ${cr.fuente} vence en ${d} días (${cr.fechaVencimiento}) · autorizado ${money(cr.monto)} + accesorios.` });
    });
    parcelasT.forEach(p => {
      const c = costosParcela[p.id];
      if (!c) return;
      if (c.utilidad < 0) a.push({ nivel: "rojo", ambito: "fin", texto: `${p.cultivo} (${p.nombre}) proyecta pérdida de ${money(Math.abs(c.utilidad))}. Equilibrio: ${num(c.puntoEq, 2)} ton/ha vs ${num(p.rendEsperado, 2)} esperadas.` });
      else if (p.rendEsperado > 0 && c.puntoEq / p.rendEsperado > 0.85) a.push({ nivel: "ambar", ambito: "fin", texto: `${p.cultivo} (${p.nombre}) trae margen apretado: precio mínimo ${money(c.precioEq)}/ton.` });
    });
    if (inversionTotal > 0 && costoFinTotal / inversionTotal > 0.12)
      a.push({ nivel: "ambar", ambito: "fin", texto: `El costo financiero ya es ${num((costoFinTotal / inversionTotal) * 100, 1)}% de tu inversión total.` });
    comprasT.filter(c => c.origen === "externo" && !c.fechaPago && diasEntre(c.fecha, hoyStr) > 90)
      .forEach(c => a.push({ nivel: "ambar", ambito: "fin", texto: `La compra a crédito de proveedor de ${c.insumoNombre} lleva ${diasEntre(c.fecha, hoyStr)} días al ${num(c.tasa, 1)}% (${money(interesCompra(c))} acumulado).` }));
    insumosAlmacen.filter(i => i.stock <= 2).forEach(i => a.push({ nivel: "ambar", ambito: "op", texto: `Stock bajo de ${i.nombre}: quedan ${num(i.stock, 1)} ${i.unidad}.` }));
    if (rayaPendiente > 0) a.push({ nivel: "info", ambito: "op", texto: `Raya pendiente: ${money(rayaPendiente)} para el próximo día de pago.` });
    const sinAplicar = prestamosT.reduce((s, pp) => s + Math.max(0, pp.monto - (pp.aplicaciones || []).reduce((x, ap) => x + ap.monto, 0)), 0);
    if (sinAplicar > 0) a.push({ nivel: "info", ambito: "fin", texto: `Préstamos en efectivo con ${money(sinAplicar)} sin aplicar — registra en qué se usó ese dinero.` });
    /* Avisos: operaciones de línea pagadas al productor pero disposición sin liquidar en la financiera.
       La disposición sigue devengando interés aunque el productor ya pagó su parte.
       Usa la misma fórmula que v_disposicion_interes: monto × tasa/365 × días.
       "días" se calcula con diasEntre(fechaPago, hoyStr) — ambas fechas son strings YYYY-MM-DD del
       navegador (hora local Mochis), sin CURRENT_DATE de la DB → sin desfase UTC. */
    const tasaPorLineaId = Object.fromEntries(creditosT.map(c => [c.id, (c.tiie || 0) + (c.spread || 0)]));
    prestamosT
      .filter(pp => pp.origen === "linea" && pp.fechaPago && pp.disposicionId
        && freezePorDispId[pp.disposicionId] && !freezePorDispId[pp.disposicionId].saldada)
      .forEach(pp => {
        const prod = productores.find(x => x.id === pp.productorId);
        const dias = diasEntre(pp.fechaPago, hoyStr);
        const tasa = tasaPorLineaId[pp.creditoId] || 0;
        const interes = pp.monto * (tasa / 100 / 365) * Math.max(0, dias);
        a.push({ nivel: "ambar", ambito: "fin",
          texto: `Préstamo de ${prod ? prod.codigo : "productor"} marcado como pagado el ${pp.fechaPago}, pero su disposición de línea sigue sin liquidar (${money(pp.monto)}) — lleva ${dias} día${dias !== 1 ? "s" : ""} devengando (~${money(interes)} de interés adicional). Ve a Costo financiero y liquídala.` });
      });
    parcelasT
      .filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "linea"
        && p.fechaPagoRenta && p.disposicionId
        && freezePorDispId[p.disposicionId] && !freezePorDispId[p.disposicionId].saldada)
      .forEach(p => {
        const monto = rentaMonto(p);
        const dias = diasEntre(p.fechaPagoRenta, hoyStr);
        const tasa = tasaPorLineaId[p.rentaCreditoId] || 0;
        const interes = monto * (tasa / 100 / 365) * Math.max(0, dias);
        a.push({ nivel: "ambar", ambito: "fin",
          texto: `Renta de "${p.nombre}" marcada como pagada el ${p.fechaPagoRenta}, pero su disposición de línea sigue sin liquidar (${money(monto)}) — lleva ${dias} día${dias !== 1 ? "s" : ""} devengando (~${money(interes)} de interés adicional). Ve a Costo financiero y liquídala.` });
      });
    const porAutorizar = solicitudesT.filter(s => s.estado === "cotizado").length;
    const porCotizar = solicitudesT.filter(s => s.estado === "solicitado").length;
    const porRecibir = solicitudesT.filter(s => s.estado === "autorizado").length;
    if (porAutorizar > 0) a.push({ nivel: "ambar", ambito: "fin", texto: `${porAutorizar} solicitud(es) de compra cotizada(s) esperan tu autorización.` });
    if (porCotizar > 0) a.push({ nivel: "info", ambito: "op", texto: `${porCotizar} solicitud(es) de compra esperan cotización.` });
    if (porRecibir > 0) a.push({ nivel: "info", ambito: "op", texto: `${porRecibir} compra(s) autorizada(s) por recibir en almacén.` });
    if (cajaPorAutorizar > 0) a.push({ nivel: "ambar", ambito: "fin", texto: `Caja chica: ${money(cajaPorAutorizar)} en salidas por autorizar.` });
    return veFinanzas ? a : a.filter(x => x.ambito === "op");
  }, [parcelasT, costosParcela, inversionTotal, costoFinTotal, comprasT, insumosAlmacen, rayaPendiente, creditosT, veFinanzas, solicitudesT, cajaPorAutorizar, prestamosT, freezePorDispId]);

  /* --- helper: diésel del catálogo (para FormLabor y el panel) --- */
  const dieselIns = insumos.find(i => i.categoria === "Diésel");

  /* --- LABORES (base de datos · RPC atómica con candado de stock) ---
     guardarLabor/eliminarLabor llaman fn_registrar_labor/fn_eliminar_labor. El candado vive
     en la base (valida stock antes de descontar; si no alcanza, rechaza todo). Escritura
     PESIMISTA: invalida labores + stock + catálogo y refetchea la verdad. */
  const guardarLaborMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const parcelaUuid = f.parcelaId || null;
      if (!parcelaUuid) throw new Error("Selecciona una parcela.");
      const lineas = [];
      const litros = Number(f.litrosDiesel) || 0;
      if (litros > 0) {
        if (!dieselIns?._uuid) throw new Error("No encontré el diésel en el catálogo de la base.");
        lineas.push({ insumo_id: dieselIns._uuid, cantidad: litros, costo_unitario: dieselIns.costoUnitario || 0 });
      }
      const insumoUuid = f.insumoId || null;
      const cant = Number(f.cantidad) || 0;
      if (insumoUuid && cant > 0) {
        const ins = insumos.find(i => i.id === insumoUuid);
        if (!ins) throw new Error("Selecciona un insumo válido.");
        lineas.push({ insumo_id: ins._uuid, cantidad: cant, costo_unitario: ins.costoUnitario || 0 });
      }
      const { error } = await supabase.rpc("fn_registrar_labor", {
        p_labor_id: original?._uuid ?? null,
        p_parcela_id: parcelaUuid,
        p_fecha: f.fecha,
        p_tipo: f.tipo,
        p_descripcion: f.desc || "",
        p_costo_operacion: Number(f.costoOp) || 0,
        p_lineas: lineas,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["labores", CICLO_ID], ["inventario-stock", CICLO_ID], ["inventario-mov", CICLO_ID], ["insumos"]],
    successMsg: "Labor guardada",
  });
  const eliminarLaborMut = useOrgWrite({
    mutationFn: async (l) => {
      const { error } = await supabase.rpc("fn_eliminar_labor", { p_labor_id: l._uuid, p_org: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: [["labores", CICLO_ID], ["inventario-stock", CICLO_ID], ["inventario-mov", CICLO_ID], ["insumos"]],
    successMsg: "Labor eliminada",
  });
  const guardarLabor = (f, original) => guardarLaborMut.mutate({ f, original }, { onSuccess: cerrar });
  /* "Guardar y repetir": guarda la labor y deja el form abierto para el
     siguiente lote (el form vacía parcela y cantidades por su cuenta). */
  const guardarLaborRepetir = (f, listo) => guardarLaborMut.mutate({ f, original: null }, { onSuccess: listo });
  const eliminarLabor = (l) => eliminarLaborMut.mutate(l);

  /* Orden flaca: la oficina anota "hacer X en parcela Y"; no baja bodega ni
     suma costo hasta que el de campo la marca hecha (mismo fn_registrar_labor). */
  const guardarOrdenMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      if (!f.parcelaId) throw new Error("Selecciona una parcela.");
      const { error } = await supabase.rpc("fn_registrar_labor", {
        p_labor_id: original?._uuid ?? null,
        p_parcela_id: f.parcelaId,
        p_fecha: original?.fecha || hoyStr,
        p_tipo: f.tipo,
        p_descripcion: f.desc || "",
        p_estado: "pendiente",
        p_plan_insumo_id: f.insumoId || null,
        p_plan_cantidad: Number(f.cantidad) || 0,
        p_plan_litros_diesel: Number(f.litrosDiesel) || 0,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["labores", CICLO_ID]],
    successMsg: "Orden anotada",
  });
  const guardarOrden = (f, original, onListo) => guardarOrdenMut.mutate({ f, original }, { onSuccess: onListo });

  /* Catálogo de tipos de labor y actividades de raya: la base fija + lo que el
     predio agrega (tabla tipo_trabajo). Así "Deshierbe" y "desierbe" no parten
     el reporte entre dos capturistas. */
  const tiposQ = useOrgRead(["tipos-trabajo"], "tipo_trabajo", { build: (q) => q.is("eliminado_en", null).order("nombre") });
  const tiposLabor = useMemo(() => {
    const extra = (tiposQ.data ?? []).filter((t) => t.ambito === "labor").map((t) => String(t.nombre));
    return [...TIPOS_LABOR.filter((t) => t !== "Otro"), ...extra, "Otro"];
  }, [tiposQ.data]);
  const actividadesRaya = useMemo(() => {
    const extra = (tiposQ.data ?? []).filter((t) => t.ambito === "raya").map((t) => String(t.nombre));
    return [...ACTIVIDADES_RAYA, ...extra];
  }, [tiposQ.data]);
  const agregarTipoMut = useOrgWrite({
    mutationFn: async ({ ambito, nombre }) => {
      const n = String(nombre || "").trim();
      if (!n) throw new Error("Escribe el nombre.");
      const { error } = await supabase.from("tipo_trabajo").insert({ organizacion_id: ORG_ID, ambito, nombre: n });
      if (error) throw new Error(error.message);
    },
    invalidate: [["tipos-trabajo"]],
    successMsg: "Agregado al catálogo",
  });
  const agregarTipoLabor = (nombre) => agregarTipoMut.mutate({ ambito: "labor", nombre });
  const agregarActividadRaya = (nombre) => agregarTipoMut.mutate({ ambito: "raya", nombre });

  /* Catálogo de cultivos: los comunes del valle + los del predio. */
  const cultivosQ = useOrgRead(["cultivos"], "cultivo", { build: (q) => q.is("eliminado_en", null).order("nombre") });
  const cultivos = useMemo(() => {
    const extra = (cultivosQ.data ?? []).map((c) => String(c.nombre));
    return [...CULTIVOS_VALLE, ...extra];
  }, [cultivosQ.data]);
  const agregarCultivoMut = useOrgWrite({
    mutationFn: async (nombre) => {
      const n = String(nombre || "").trim();
      if (!n) throw new Error("Escribe el nombre.");
      const { error } = await supabase.from("cultivo").insert({ organizacion_id: ORG_ID, nombre: n });
      if (error) throw new Error(error.message);
    },
    invalidate: [["cultivos"]],
    successMsg: "Cultivo agregado al catálogo",
  });
  const agregarCultivo = (nombre) => agregarCultivoMut.mutate(nombre);

  /* --- PARCELAS (base de datos) --- */
  const guardarParcelaMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const esRentada = f.tenencia === "Rentada";
      const rentaOrigen = esRentada ? (f.rentaOrigen || "propio") : null;
      let lineaUuid = null;
      if (rentaOrigen === "linea") {
        lineaUuid = f.rentaCreditoId || null;   // B2a: f.rentaCreditoId ES el uuid de la línea
        if (!lineaUuid) throw new Error("No encontré esa línea de crédito en la base. Revisa el crédito de la renta.");
      }
      const { error } = await supabase.rpc("fn_guardar_parcela", {
        p_id: original?._uuid ?? null,
        p_organizacion_id: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_productor_id: f.productorId || null,
        p_nombre: f.nombre,
        p_cultivo: f.cultivo,
        p_ha: Number(f.ha) || 0,
        p_rend_esperado: Number(f.rendEsperado) || 0,
        p_precio_esperado: Number(f.precioEsperado) || 0,
        p_tenencia: f.tenencia,
        p_renta_por_ha: esRentada ? (Number(f.rentaPorHa) || 0) : null,
        p_renta_origen: rentaOrigen,
        p_tasa_renta: rentaOrigen === "externo" ? (Number(f.tasaRenta) || 0) : null,
        p_fecha_renta: esRentada ? (f.fechaRenta || hoyStr) : null,
        // 'propio' arranca su fecha de pago = fecha de contrato (paridad con el prototipo);
        // en edición se preserva la que ya traía.
        p_fecha_pago_renta: original?.fechaPagoRenta ?? (esRentada && rentaOrigen === "propio" ? (f.fechaRenta || hoyStr) : null),
        p_linea_credito_id: lineaUuid,
      });
      if (error) throw new Error(error.message);
    },
    // refresca parcelasT (y su renta en dispsDeLinea).
    invalidate: [["parcelas", CICLO_ID]],
    successMsg: "Parcela guardada",
  });
  const eliminarParcelaMut = useOrgWrite({
    mutationFn: async (p) => {
      const { error } = await supabase.rpc("fn_eliminar_parcela", { p_id: p._uuid, p_organizacion_id: ORG_ID });
      if (error) throw new Error(error.message);
    },
    // soft-delete: al salir de parcelasT, sus labores/boletas/nómina/gastos se filtran solas del costo/ha.
    invalidate: [["parcelas", CICLO_ID]],
    successMsg: "Parcela dada de baja",
  });
  const pagarRentaMut = useOrgWrite({
    mutationFn: async (p) => {
      const { error } = await supabase.from("parcela")
        .update({ fecha_pago_renta: hoyStr }).eq("id", p._uuid).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    invalidate: [["parcelas", CICLO_ID]],
    successMsg: "Renta marcada como pagada",
  });
  const guardarParcela = (f, original) => guardarParcelaMut.mutate({ f, original }, { onSuccess: cerrar });
  const eliminarParcela = (p) => eliminarParcelaMut.mutate(p);
  const pagarRenta = (p) => pagarRentaMut.mutate(p);

  /* --- COMPRAS (base de datos) ---
     fn_guardar_compra hace alta/edición atómica: find-or-create proveedor por nombre, reconcilia la
     ENTRADA de inventario (borra la vieja por origen_id y crea la nueva → editar NO duplica stock), y
     maneja la disposición de línea encontrar-y-actualizar (si la compra ya trae disposición la
     actualiza, no crea otra). Insumo nuevo (texto libre): p_insumo_id null → no toca stock.
     Traducciones front→base: insumoId YA es el uuid del insumo (slice INSUMOS); creditoId YA es el uuid de
     la línea (B2a, puente eliminado); productorId ya es uuid. */
  const guardarCompraMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const origen = f.origen || "propio";
      const esNuevo = !f.insumoId;
      let insumoUuid = null, insumoNombre = null;
      if (esNuevo) {
        insumoNombre = (f.insumoNuevo || "").trim() || null;
      } else {
        const ins = insumosT.find((i) => i.id === f.insumoId);
        insumoUuid = ins?._uuid ?? null;
        insumoNombre = ins?.nombre ?? null;
      }
      let lineaUuid = null;
      if (origen === "linea") {
        lineaUuid = f.creditoId || null;   // B2a: f.creditoId ES el uuid de la línea
        if (!lineaUuid) throw new Error("No encontré esa línea de crédito en la base. Revisa el crédito elegido.");
      }
      const { error } = await supabase.rpc("fn_guardar_compra", {
        p_compra_id: original?._uuid ?? null,
        p_org: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_insumo_id: insumoUuid,
        p_insumo_nombre: insumoNombre,
        p_proveedor_nombre: f.proveedor || null,
        p_productor_id: f.productorId || null,
        p_cantidad: Number(f.cantidad) || 0,
        p_unidad: f.unidad || null,
        p_costo_unitario: Number(f.costoUnitario) || 0,
        p_fecha: f.fecha,
        p_origen: origen,
        p_linea_id: lineaUuid,
        p_tasa_externa: origen === "externo" ? (Number(f.tasa) || 0) : 0,
        p_fecha_pago_externo: origen === "externo" ? (original?.fechaPago || null) : null,
        p_solicitud_id: null,
        p_categoria: esNuevo ? (f.categoria || "Otro") : null,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["compras", CICLO_ID], ["inventario-stock", CICLO_ID], ["inventario-mov", CICLO_ID], ["insumos"], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Compra guardada",
  });
  const guardarCompra = (f, original) => guardarCompraMut.mutate({ f, original }, { onSuccess: cerrar });

  const eliminarCompraMut = useOrgWrite({
    mutationFn: async (c) => {
      const { error } = await supabase.rpc("fn_eliminar_compra", { p_compra_id: c._uuid, p_org: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: [["compras", CICLO_ID], ["inventario-stock", CICLO_ID], ["inventario-mov", CICLO_ID], ["insumos"], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Compra eliminada",
  });
  const eliminarCompra = (c) => eliminarCompraMut.mutate(c);

  const marcarPagadaMut = useOrgWrite({
    mutationFn: async (c) => {
      const { error } = await supabase.from("compra").update({ fecha_pago_externo: hoyStr }).eq("id", c._uuid).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    invalidate: [["compras", CICLO_ID]],
    successMsg: "Compra marcada como pagada",
  });
  const marcarPagada = (c) => marcarPagadaMut.mutate(c);


  /* --- NÓMINA --- */
  /* --- NÓMINA / RAYA (base de datos) --- */
  const guardarNominaMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const parcelaUuid = f.parcelaId || null;
      if (!parcelaUuid) throw new Error("Selecciona una parcela.");
      const reg = {
        organizacion_id: ORG_ID, ciclo_id: CICLO_ID, parcela_id: parcelaUuid,
        fecha: f.fecha, tipo: f.tipo, cuadrilla: (f.cuadrilla || "").trim(), actividad: f.actividad || "",
        personas: Number(f.personas) || 0, dias: Number(f.dias) || 0, pago_diario: Number(f.pago) || 0,
      };
      if (original) {
        // NO se tocan pagado/fecha_pago al editar (se preservan).
        const { error } = await supabase.from("jornal").update(reg)
          .eq("id", original._uuid).eq("organizacion_id", ORG_ID);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("jornal").insert({ ...reg, pagado: false });
        if (error) throw new Error(error.message);
      }
    },
    invalidate: [["nomina", CICLO_ID]],
    successMsg: "Trabajo guardado",
  });
  const eliminarNominaMut = useOrgWrite({
    mutationFn: async (n) => {
      const { error } = await supabase.from("jornal")
        .update({ eliminado_en: new Date().toISOString() })
        .eq("id", n._uuid).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    invalidate: [["nomina", CICLO_ID]],
    successMsg: "Jornal eliminado",
  });
  const pagarRayaMut = useOrgWrite({
    mutationFn: async (nombre) => {
      const ids = nominaT.filter(n => !n.pagado && n.cuadrilla === nombre).map(n => n._uuid);
      if (!ids.length) return;
      const { error } = await supabase.from("jornal")
        .update({ pagado: true, fecha_pago: hoyStr })
        .in("id", ids).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    invalidate: [["nomina", CICLO_ID]],
    successMsg: "Raya pagada",
  });
  const guardarNomina = (f, original) => guardarNominaMut.mutate({ f, original }, { onSuccess: cerrar });
  const eliminarNomina = (n) => eliminarNominaMut.mutate(n);
  const pagarRayaPersona = (nombre) => pagarRayaMut.mutate(nombre);

  const directorio = useMemo(() => {
    const map = {};
    nomina.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(n => {
      map[n.cuadrilla] = { nombre: n.cuadrilla, tipo: n.tipo, pago: n.pago };
    });
    return Object.values(map);
  }, [nomina]);

  const rayaPorPersona = useMemo(() => {
    const map = {};
    nominaT.filter(n => !n.pagado).forEach(n => {
      const t = n.personas * n.dias * n.pago;
      if (!map[n.cuadrilla]) map[n.cuadrilla] = { nombre: n.cuadrilla, tipo: n.tipo, total: 0, registros: 0, jornales: 0 };
      map[n.cuadrilla].total += t;
      map[n.cuadrilla].registros += 1;
      map[n.cuadrilla].jornales += n.personas * n.dias;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [nominaT]);

  /* --- CRÉDITOS (base de datos) --- */
  const CREDITO_INVALIDATE = [["lineas-credito", CICLO_ID], ["v-linea-estado", CICLO_ID],
    ["dispersiones", CICLO_ID], ["parcelas", CICLO_ID], ["gastos", CICLO_ID],
    ["compras", CICLO_ID], ["prestamos", CICLO_ID], ["caja-movs", CICLO_ID]];
  const guardarCreditoMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const { error } = await supabase.rpc("fn_guardar_linea_credito", {
        p_id: original?._uuid ?? null,
        p_organizacion_id: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_tipo_credito: f.tipoCredito,
        p_fuente: f.fuente,
        p_monto_autorizado: Number(f.monto) || 0,
        p_tiie: Number(f.tiie) || 0,
        p_spread: Number(f.spread) || 0,
        p_fecha_inicio: f.fechaInicio,
        p_productor_id: f.productorId || null,
        p_comision_pct: Number(f.comision) || 0,
        p_fega_pct: Number(f.fega) || 0,
        p_fecha_vencimiento: f.fechaVencimiento || null,
        p_destino: f.destino || null,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: CREDITO_INVALIDATE,
    successMsg: "Crédito guardado",
  });
  const eliminarCreditoMut = useOrgWrite({
    mutationFn: async (cr) => {
      const { error } = await supabase.rpc("fn_eliminar_linea_credito", { p_id: cr._uuid, p_organizacion_id: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: CREDITO_INVALIDATE,
    successMsg: "Crédito eliminado",
  });

  /* PAGOS PARCIALES: abonar / liquidar resto / revertir un abono contra pago_disposicion.
     liquidar: p_monto=null → resto (saldo); p_monto=N → abono parcial. Candados de sobrepago y
     fecha futura viven en la base (fn_liquidar_disposicion); el error sale como toast.
     revertir: p_pago_id=null → revierte todo (compat 2 args); p_pago_id=id → ese abono.
     Invalida la vista de líneas, los 6 reads operativos, el freeze y la lista de abonos. */
  const LIQUIDAR_INVALIDATE = [...CREDITO_INVALIDATE, ["disp-interes", CICLO_ID], ["pagos-disp"]];
  const liquidarDisposicionMut = useOrgWrite({
    mutationFn: async ({ dispId, fecha, monto }) => {
      if (!dispId) throw new Error("Esta disposición todavía no existe en la base.");
      const { error } = await supabase.rpc("fn_liquidar_disposicion", {
        p_disposicion_id: dispId,
        p_organizacion_id: ORG_ID,
        p_fecha: fecha || hoyStr,
        p_monto: (monto === null || monto === undefined || monto === "") ? null : Number(monto),
        p_nota: null,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: LIQUIDAR_INVALIDATE,
    successMsg: "Abono registrado",
  });
  const revertirLiquidacionMut = useOrgWrite({
    mutationFn: async ({ dispId, pagoId }) => {
      if (!dispId) throw new Error("Esta disposición todavía no existe en la base.");
      const { error } = await supabase.rpc("fn_revertir_liquidacion", {
        p_disposicion_id: dispId,
        p_organizacion_id: ORG_ID,
        p_pago_id: pagoId ?? null,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: LIQUIDAR_INVALIDATE,
    successMsg: "Reversión aplicada",
  });
  const liquidarDisposicion = (dispId, fecha, monto = null) => liquidarDisposicionMut.mutate({ dispId, fecha, monto });
  const revertirLiquidacion = (dispId, pagoId = null) => revertirLiquidacionMut.mutate({ dispId, pagoId });
  const guardarCredito = (f, original) => guardarCreditoMut.mutate({ f, original }, { onSuccess: cerrar });
  const eliminarCredito = (cr) => eliminarCreditoMut.mutate(cr);

  /* --- BOLETAS (base de datos) --- */
  const guardarBoletaMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const parcelaUuid = f.parcelaId || null;
      if (!parcelaUuid) throw new Error("Selecciona una parcela.");
      const { error } = await supabase.rpc("fn_guardar_boleta", {
        p_boleta_id: original?._uuid ?? null,
        p_org: ORG_ID,
        p_parcela_id: parcelaUuid,
        p_fecha: f.fecha,
        p_bodega: f.bodega || null,          // texto libre; find-or-create de almacenadora por nombre
        p_folio: f.boleta || null,
        p_peso_bruto: Number(f.pesoBruto) || 0,
        p_tara: Number(f.tara) || 0,
        p_humedad: Number(f.humedad) || 0,
        p_impurezas: Number(f.impurezas) || 0,
        p_humedad_std: veFinanzas ? (Number(f.hStd) || 14) : null,
        p_impurezas_std: veFinanzas ? (Number(f.iStd) || 2) : null,
        // Sin finanzas → null: el servidor conserva el precio/deducciones reales de la boleta.
        p_precio_ton: veFinanzas ? (Number(f.precioTon) || 0) : null,
        p_trilla: veFinanzas ? (Number(f.trilla) || 0) : null,
        p_flete: veFinanzas ? (Number(f.flete) || 0) : null,
        p_otros: veFinanzas ? (Number(f.otros) || 0) : null,
      });
      if (error) throw new Error(error.message);
    },
    // Las boletas son ABONOS en el estado de cuenta (vía v_boleta) → refrescar la cuenta del productor.
    invalidate: [["boletas", CICLO_ID], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Boleta guardada",
  });
  const eliminarBoletaMut = useOrgWrite({
    mutationFn: async (b) => {
      const { error } = await supabase.from("boleta")
        .update({ eliminado_en: new Date().toISOString() })
        .eq("id", b._uuid).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    invalidate: [["boletas", CICLO_ID], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Boleta eliminada",
  });
  const guardarBoleta = (f, original) => guardarBoletaMut.mutate({ f, original }, { onSuccess: cerrar });
  const eliminarBoleta = (b) => eliminarBoletaMut.mutate(b);

  /* --- GASTOS (base de datos) --- */
  const guardarGastoMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const origen = f.origen || "propio";
      let lineaUuid = null;
      if (origen === "linea") {
        lineaUuid = f.creditoId || null;   // B2a: f.creditoId ES el uuid de la línea
        if (!lineaUuid) throw new Error("No encontré esa línea de crédito en la base. Revisa el crédito elegido.");
      }
      let parcelaUuid = null;
      if (f.destino === "parcela") {
        parcelaUuid = f.parcelaId || null;
        if (!parcelaUuid) throw new Error("Selecciona una parcela o usa prorrateo/general.");
      }
      const { error } = await supabase.rpc("fn_guardar_gasto", {
        p_id: original?._uuid ?? null,
        p_organizacion_id: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_fecha: f.fecha,
        p_categoria: f.categoria,
        p_descripcion: f.desc || "",
        p_monto: Number(f.monto) || 0,
        p_destino: f.destino,
        p_parcela_id: parcelaUuid,
        p_productor_id: f.productorId || null,
        p_origen: origen,
        p_linea_credito_id: lineaUuid,
        p_tasa_externa: origen === "externo" ? (Number(f.tasa) || 0) : 0,
        p_fecha_pago_externo: origen === "externo" ? (original?.fechaPago || null) : null,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["gastos", CICLO_ID], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Gasto guardado",
  });
  const guardarGasto = (f, original) => guardarGastoMut.mutate({ f, original }, { onSuccess: cerrar });

  const eliminarGastoMut = useOrgWrite({
    mutationFn: async (g) => {
      const { error } = await supabase.rpc("fn_eliminar_gasto", { p_id: g._uuid, p_organizacion_id: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: [["gastos", CICLO_ID], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Gasto eliminado",
  });
  const eliminarGasto = (g) => eliminarGastoMut.mutate(g);

  /* --- PRODUCTORES / DISPERSIONES --- */
  const altaProductorMut = useOrgWrite({
    mutationFn: async ({ reg, original }) => {
      if (original) {
        const { error } = await supabase.from("productor").update(reg).eq("id", original.id).eq("organizacion_id", ORG_ID);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("productor").insert({ ...reg, organizacion_id: ORG_ID });
        if (error) throw new Error(error.message);
      }
    },
    invalidate: [["productores"]],
    successMsg: "Productor guardado",
  });
  const bajaProductorMut = useOrgWrite({
    mutationFn: async (pr) => {
      const { error } = await supabase.from("productor").update({ activo: false }).eq("id", pr.id).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    invalidate: [["productores"]],
    successMsg: "Productor dado de baja",
  });
  const guardarProductor = (f, original) => {
    const reg = { codigo: (f.codigo || "").trim(), nombre: (f.nombre || "").trim(), contrato: (f.contrato || "").trim(), rfc: (f.rfc || "").trim().toUpperCase(), tipo: TIPO_ENUM[f.tipo] ?? "prestanombre" };
    altaProductorMut.mutate({ reg, original }, { onSuccess: cerrar });
  };
  const eliminarProductor = (pr) => bajaProductorMut.mutate(pr);
  const guardarInsumoMut = useOrgWrite({
    mutationFn: async ({ reg, original }) => {
      if (original) {
        const { error } = await supabase.from("insumo").update(reg).eq("id", original.id).eq("organizacion_id", ORG_ID);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("insumo").insert({ ...reg, organizacion_id: ORG_ID, activo: true });
        if (error) throw new Error(error.message);
      }
    },
    invalidate: [["insumos"]],
    successMsg: "Insumo guardado",
  });
  const bajaInsumoMut = useOrgWrite({
    mutationFn: async (ins) => {
      const { error } = await supabase.from("insumo").update({ activo: false }).eq("id", ins.id).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    invalidate: [["insumos"]],
    successMsg: "Insumo dado de baja",
  });
  const guardarInsumo = (f, original) => {
    const reg = {
      nombre: (f.nombre || "").trim(),
      unidad: (f.unidad || "").trim() || "L",
      categoria: f.categoria || "Agroquímico",
      costo_unitario_ref: Number(f.costoUnitario) || 0,
    };
    guardarInsumoMut.mutate({ reg, original }, { onSuccess: () => setForm(null) });
  };
  const eliminarInsumo = (ins) => bajaInsumoMut.mutate(ins);
  const guardarDispersionMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      let lineaUuid = null;
      if (f.origen === "linea") {
        lineaUuid = f.creditoId || null;   // B2a: f.creditoId ES el uuid de la línea
        if (!lineaUuid) throw new Error("No encontré esa línea de crédito en la base. Revisa el crédito elegido.");
      }
      const { error } = await supabase.rpc("fn_guardar_dispersion", {
        p_id: original?.id ?? null,
        p_organizacion_id: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_productor_id: f.productorId,
        p_fecha: f.fecha,
        p_concepto: f.concepto,
        p_monto: Number(f.monto) || 0,
        p_observacion: f.observacion || "",
        p_origen: f.origen || "propio",
        p_linea_credito_id: lineaUuid,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["dispersiones", CICLO_ID], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Dispersión guardada",
  });
  const eliminarDispersionMut = useOrgWrite({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc("fn_eliminar_dispersion", { p_id: id, p_organizacion_id: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: [["dispersiones", CICLO_ID], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Dispersión eliminada",
  });
  const guardarDispersion = (f, original) => guardarDispersionMut.mutate({ f, original }, { onSuccess: cerrar });
  const eliminarDispersion = (id) => eliminarDispersionMut.mutate(id);

  /* --- PRÉSTAMOS EN EFECTIVO (base de datos) --- */
  const guardarPrestamoMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      let lineaUuid = null;
      if (f.origen === "linea") {
        lineaUuid = f.creditoId || null;   // B2a: f.creditoId ES el uuid de la línea
        if (!lineaUuid) throw new Error("No encontré esa línea de crédito en la base. Revisa el crédito elegido.");
      }
      const { error } = await supabase.rpc("fn_guardar_prestamo", {
        p_id: original?.id ?? null,
        p_organizacion_id: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_productor_id: f.productorId,
        p_fecha: f.fecha,
        p_monto: Number(f.monto) || 0,
        p_nota: f.nota || "",
        p_origen: f.origen || "propio",
        p_linea_credito_id: lineaUuid,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["prestamos", CICLO_ID], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Préstamo guardado",
  });
  const eliminarPrestamoMut = useOrgWrite({
    mutationFn: async (pp) => {
      const { error } = await supabase.rpc("fn_eliminar_prestamo", { p_id: pp.id, p_organizacion_id: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: [["prestamos", CICLO_ID], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Préstamo eliminado",
  });
  const liquidarPrestamoMut = useOrgWrite({
    mutationFn: async (pp) => {
      const { error } = await supabase.from("prestamo")
        .update({ fecha_pago: hoyStr }).eq("id", pp.id).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    // Liquidar solo cambia el devengo de interés (motor JS sobre prestamosT) → invalida préstamos.
    // pago_disposicion en el ledger se cablea en el slice de créditos (decisión acordada).
    invalidate: [["prestamos", CICLO_ID]],
    successMsg: "Préstamo marcado como liquidado",
  });
  const agregarAplicacionMut = useOrgWrite({
    mutationFn: async ({ prestamoId, f }) => {
      let parcelaUuid = null;
      if (f.tipo === "productivo" && f.destino === "parcela") {
        parcelaUuid = f.parcelaId || null;
        if (!parcelaUuid) throw new Error("Selecciona una parcela o usa prorrateo.");
      }
      const { error } = await supabase.from("prestamo_aplicacion").insert({
        organizacion_id: ORG_ID,
        prestamo_id: prestamoId,
        fecha: f.fecha,
        concepto: (f.concepto || "").trim(),
        monto: Number(f.monto) || 0,
        tipo: f.tipo,
        destino: f.tipo === "productivo" ? f.destino : null,
        parcela_id: parcelaUuid,
      });
      if (error) throw new Error(error.message);
    },
    // Las aplicaciones NO tocan la cuenta del productor (esa solo cuenta la bolsa);
    // sí alimentan costo/ha (apsProductivas deriva de prestamosT) → invalida préstamos.
    invalidate: [["prestamos", CICLO_ID]],
    successMsg: "Aplicación registrada",
  });
  const eliminarAplicacionMut = useOrgWrite({
    mutationFn: async (apId) => {
      const { error } = await supabase.from("prestamo_aplicacion")
        .update({ eliminado_en: new Date().toISOString() }).eq("id", apId).eq("organizacion_id", ORG_ID);
      if (error) throw new Error(error.message);
    },
    invalidate: [["prestamos", CICLO_ID]],
    successMsg: "Aplicación eliminada",
  });
  const guardarPrestamo = (f, original) => guardarPrestamoMut.mutate({ f, original }, { onSuccess: cerrar });
  const eliminarPrestamo = (pp) => eliminarPrestamoMut.mutate(pp);
  const liquidarPrestamo = (pp) => liquidarPrestamoMut.mutate(pp);
  const agregarAplicacion = (prestamoId, f) => agregarAplicacionMut.mutate({ prestamoId, f });
  const eliminarAplicacion = (prestamoId, apId) => eliminarAplicacionMut.mutate(apId);

  /* --- SOLICITUDES DE COMPRA (pipeline · base de datos) ---
     Las 7 operaciones pasan por RPCs (mismo patrón que tesorería/caja). El front ya no
     guarda estado en memoria: cada mutación invalida ["solicitudes", CICLO_ID] y la verdad
     se re-lee de solicitud_compra. RECIBIR es la única que toca el ledger. */
  const resolverProductorUuid = (pid) => {
    if (!pid) return null;
    if (productores.some((p) => p.id === pid)) return pid;
    return productores.find((p) => String(p.codigo) === String(pid))?.id ?? null;
  };

  // Alta / edición → fn_guardar_solicitud (p_id null = nueva; uuid = edición)
  const guardarSolicitudMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const insumoId = f.insumoId && f.insumoId !== "nuevo" ? f.insumoId : null;
      const insumoNombre = insumoId ? (insumos.find((i) => i.id === insumoId)?.nombre || "") : (f.insumoNuevo || "");
      const { error } = await supabase.rpc("fn_guardar_solicitud", {
        p_id: original?.id ?? null,
        p_org: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_fecha: f.fecha,
        p_solicitante: (f.solicitante || "").trim(),
        p_insumo_id: insumoId,
        p_insumo_nombre: insumoNombre,
        p_unidad: f.unidad || null,
        p_cantidad: Number(f.cantidad) || 0,
        p_categoria: f.categoria || "Otro",
        p_motivo: f.motivo || null,
        p_parcela_id: f.parcelaId || null,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["solicitudes", CICLO_ID]],
    successMsg: "Solicitud guardada",
  });
  const guardarSolicitud = (f, original) => guardarSolicitudMut.mutate({ f, original }, { onSuccess: cerrar });

  // Eliminar (soft-delete) → fn_eliminar_solicitud
  const eliminarSolicitudMut = useOrgWrite({
    mutationFn: async (sol) => {
      const { error } = await supabase.rpc("fn_eliminar_solicitud", { p_id: sol.id, p_org: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: [["solicitudes", CICLO_ID]],
    successMsg: "Solicitud eliminada",
  });
  const eliminarSolicitud = (sol) => eliminarSolicitudMut.mutate(sol);

  // Agregar cotización (+ sube a "cotizado") → fn_agregar_cotizacion
  const agregarCotizacionMut = useOrgWrite({
    mutationFn: async ({ sol, cot }) => {
      const { error } = await supabase.rpc("fn_agregar_cotizacion", {
        p_solicitud_id: sol.id,
        p_org: ORG_ID,
        p_proveedor_texto: cot.proveedor || null,
        p_costo_unitario: Number(cot.costoUnitario) || 0,
        p_nota: cot.nota || null,
        p_fecha: hoyStr,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["solicitudes", CICLO_ID]],
    successMsg: "Cotización agregada",
  });
  const agregarCotizacion = (sol, cot) => agregarCotizacionMut.mutate({ sol, cot });

  // Quitar cotización → fn_eliminar_cotizacion
  const eliminarCotizacionMut = useOrgWrite({
    mutationFn: async (cotId) => {
      const { error } = await supabase.rpc("fn_eliminar_cotizacion", { p_cotizacion_id: cotId, p_org: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: [["solicitudes", CICLO_ID]],
    successMsg: "Cotización quitada",
  });
  const eliminarCotizacion = (sol, cotId) => eliminarCotizacionMut.mutate(cotId);

  // Autorizar (SOLO autoriza; la compra se crea al recibir) → fn_autorizar_solicitud.
  // datos.cotizacionElegidaId y datos.creditoId YA son uuid (B2a + cotización en base).
  const autorizarSolicitudMut = useOrgWrite({
    mutationFn: async ({ sol, datos }) => {
      const origen = datos.origen || "propio";
      const { error } = await supabase.rpc("fn_autorizar_solicitud", {
        p_solicitud_id: sol.id,
        p_org: ORG_ID,
        p_cotizacion_id: datos.cotizacionElegidaId,
        p_origen: origen,
        p_linea_id: origen === "linea" ? (datos.creditoId || null) : null,
        p_tasa: origen === "externo" ? (Number(datos.tasa) || 0) : 0,
        p_productor_id: resolverProductorUuid(datos.productorId),
        p_autorizado_por_texto: rol,
        p_fecha: hoyStr,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["solicitudes", CICLO_ID]],
    successMsg: "Solicitud autorizada",
  });
  const autorizarSolicitud = (sol, datos) => autorizarSolicitudMut.mutate({ sol, datos });

  /* RECIBIR: la única que toca el ledger. fn_recibir_solicitud lee la solicitud y su
     cotización elegida, crea la compra (vía fn_guardar_compra: inventario + disposición
     si origen='linea') y marca la solicitud "recibido" con su compra_id real, todo
     atómico. El candado anti-duplicado vive en la RPC: re-recibir truena con mensaje
     claro en vez de duplicar la compra (mata el footgun del p_solicitud_id: null). */
  const recibirSolicitudMut = useOrgWrite({
    mutationFn: async (sol) => {
      const { error } = await supabase.rpc("fn_recibir_solicitud", {
        p_solicitud_id: sol.id,
        p_org: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_fecha: hoyStr,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["solicitudes", CICLO_ID], ["compras", CICLO_ID], ["inventario-stock", CICLO_ID], ["inventario-mov", CICLO_ID], ["insumos"], ["cuenta-productor", CICLO_ID], ["mov-cuenta-productor", CICLO_ID]],
    successMsg: "Solicitud recibida · compra registrada",
  });
  const recibirSolicitud = (sol) => recibirSolicitudMut.mutate(sol);

  /* --- CAJA CHICA (base de datos) --- */
  const guardarCajaFondeoMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      const origen = f.origen || "propio";
      let lineaUuid = null;
      if (origen === "linea") {
        lineaUuid = f.creditoId || null;   // B2a: f.creditoId ES el uuid de la línea
        if (!lineaUuid) throw new Error("No encontré esa línea de crédito en la base. Revisa el crédito elegido.");
      }
      const { error } = await supabase.rpc("fn_guardar_caja_fondeo", {
        p_id: original?._uuid ?? null,
        p_org: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_fecha: f.fecha,
        p_monto: Number(f.monto) || 0,
        p_origen: origen,
        p_linea_id: lineaUuid,
        p_nota: f.nota || "",
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["caja-movs", CICLO_ID]],
    successMsg: "Fondeo guardado",
  });
  const guardarCajaFondeo = (f, original) => guardarCajaFondeoMut.mutate({ f, original }, { onSuccess: cerrar });

  const guardarCajaSalidaMut = useOrgWrite({
    mutationFn: async ({ f, original }) => {
      let parcelaUuid = null;
      if (f.destino === "parcela") {
        parcelaUuid = f.parcelaId || null;
        if (!parcelaUuid) throw new Error("Selecciona una parcela o usa prorrateo/general.");
      }
      const { error } = await supabase.rpc("fn_guardar_caja_salida", {
        p_id: original?._uuid ?? null,
        p_org: ORG_ID,
        p_ciclo_id: CICLO_ID,
        p_fecha: f.fecha,
        p_monto: Number(f.monto) || 0,
        p_concepto: f.concepto || "",
        p_quien: f.quien || "",
        p_destino: f.destino,
        p_parcela_id: parcelaUuid,
        p_comprobante: !!f.comprobante,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["caja-movs", CICLO_ID], ["gastos", CICLO_ID]],
    successMsg: "Gasto de caja guardado",
  });
  const guardarCajaSalida = (f, original) => guardarCajaSalidaMut.mutate({ f, original }, { onSuccess: cerrar });

  const autorizarCajaSalidaMut = useOrgWrite({
    mutationFn: async (mov) => {
      const { error } = await supabase.rpc("fn_autorizar_caja_salida", {
        p_id: mov._uuid,
        p_org: ORG_ID,
        p_autorizado_por: null,           // dev: roles simulados, sin usuario real (shim, muere con auth)
        p_fecha_autorizacion: hoyStr,
      });
      if (error) throw new Error(error.message);
    },
    invalidate: [["caja-movs", CICLO_ID], ["gastos", CICLO_ID]],
    successMsg: "Salida autorizada",
  });
  const autorizarCajaSalida = (mov) => autorizarCajaSalidaMut.mutate(mov);

  const eliminarCajaMovMut = useOrgWrite({
    mutationFn: async (mov) => {
      const { error } = await supabase.rpc("fn_eliminar_caja_mov", { p_id: mov._uuid, p_org: ORG_ID });
      if (error) throw new Error(error.message);
    },
    invalidate: [["caja-movs", CICLO_ID], ["gastos", CICLO_ID]],
    successMsg: "Movimiento eliminado",
  });
  const eliminarCajaMov = (mov) => eliminarCajaMovMut.mutate(mov);

  const NAV_TODOS = [
    { id: "captura", nombre: "Hoy", icono: ListTodo, soloCampo: true },
    { id: "panel", nombre: "El ciclo", icono: LayoutDashboard },
    { id: "parcelas", nombre: "Parcelas", icono: Sprout },
    { id: "labores", nombre: "Labores", icono: Tractor },
    { id: "inventario", nombre: "Insumos", icono: Package },
    { id: "solicitudes", nombre: "Solicitudes", icono: ClipboardList },
    { id: "cuadrillas", nombre: "Raya", icono: Users },
    { id: "cosecha", nombre: "Cosecha", icono: Wheat },
    { id: "productores", nombre: "Productores", icono: BookUser, soloFinanzas: true },
    { id: "gastos", nombre: "Gastos", icono: Wallet, soloFinanzas: true },
    { id: "caja", nombre: "Caja chica", icono: Coins, soloFinanzas: true },
    { id: "credito", nombre: "Crédito", icono: Landmark, soloFinanzas: true },
    { id: "costofin", nombre: "Costo financiero", icono: TrendingUp, soloFinanzas: true },
    { id: "reportes", nombre: "Reportes", icono: BarChart3, soloFinanzas: true },
    { id: "ajustes", nombre: "Ajustes", icono: SlidersHorizontal, soloDueno: true },
  ];
  const NAV = NAV_TODOS.filter((n) => navVisible(rol, n.id, matriz));
  const NAV_GRUPOS = [
    { etiqueta: null, ids: ["captura", "panel"] },
    { etiqueta: "Campo", ids: ["parcelas", "labores", "inventario", "solicitudes", "cuadrillas"] },
    { etiqueta: "Venta", ids: ["cosecha", "productores"] },
    { etiqueta: "Números", ids: ["gastos", "caja", "credito", "costofin", "reportes"] },
  ];
  const NAV_MOVIL = rol === "Encargado de campo"
    ? NAV.filter((n) => ["captura", "labores", "cuadrillas", "cosecha"].includes(n.id))
    : NAV.filter((n) => n.id !== "ajustes");
  const cicloActual = ciclos.find((c) => c.id === CICLO_ID);
  const presupuestoCiclo = Number(cicloActual?.presupuesto) || 0;

  const accionRapida = (vistaDestino, tipoForm) => {
    setVista(vistaDestino);
    setForm(puedeEditar ? { tipo: tipoForm, item: null } : null);
  };

  /* Tarjetas compartidas entre Hoy y Labores: el form corto (3 toques),
     la orden flaca de la oficina y la lista Por hacer. */
  const tarjetaRapida = rapida ? (
    <Tarjeta style={{ padding: 16, borderTop: `3px solid ${C.bosque}` }}>
      <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
        {rapida.orden ? `Cerrar orden: ${rapida.orden.tipo}` : "Labor de hoy"}
      </div>
      <FormLaborRapida key={rapida.orden?.id || "nueva"} orden={rapida.orden} parcelas={parcelasT} insumos={insumos}
        tipos={tiposLabor} onAgregarTipo={agregarTipoLabor}
        onGuardar={(f) => guardarLaborMut.mutate({ f, original: rapida.orden }, { onSuccess: () => setRapida(null) })}
        onGuardarRepetir={guardarLaborRepetir}
        onCancelar={() => setRapida(null)} />
    </Tarjeta>
  ) : null;
  const tarjetaOrden = form?.tipo === "orden" ? (
    <Tarjeta style={{ padding: 16, borderTop: `3px solid ${C.grano}` }}>
      <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
        {form.item ? "Editar orden" : "Ordenar labor"}
      </div>
      <FormOrdenLabor key={form.item?.id || "nueva"} inicial={form.item} parcelas={parcelasT} insumos={insumos}
        tipos={tiposLabor} onAgregarTipo={agregarTipoLabor}
        onGuardar={(f) => guardarOrden(f, form.item, cerrar)} onCancelar={cerrar} />
    </Tarjeta>
  ) : null;
  /* Guía de arranque de El ciclo: viva mientras el ciclo no tenga ni una
     captura real (labor hecha, compra, raya o boleta). Ocultable por sesión. */
  const hayCaptura = laboresHechas.length + comprasT.length + nominaT.length + boletasT.length > 0;
  const pasosGuiaCiclo = [
    {
      titulo: "Da de alta tus parcelas",
      hint: "Una parcela es el lote que se siembra y se cosecha junto — no el predio completo.",
      done: parcelasT.length > 0,
      cta: puedeEscribirModulo(rol, "parcelas", matriz) ? { label: "Ir a Parcelas", onClick: () => { cerrar(); setVista("parcelas"); } } : null,
      nota: "Los lotes los da de alta el Dueño o la Oficina.",
    },
    {
      titulo: "Pon el presupuesto del ciclo",
      done: presupuestoCiclo > 0,
      opcional: true,
      cta: rol === "Dueño" ? { label: "Fijar en Ajustes", onClick: () => { cerrar(); setVista("ajustes"); } } : null,
      nota: "Lo fija el Dueño en Ajustes → Ciclos.",
    },
    {
      titulo: "Captura lo primero que pase en el lote",
      done: hayCaptura,
      cta: puedeLabores && parcelasT.length > 0
        ? { label: "Ir a Hoy", onClick: () => { cerrar(); setVista("captura"); setRapida({ orden: null }); } }
        : null,
      nota: parcelasT.length > 0 ? "La captura se hace en Hoy, en tres toques." : "Primero las parcelas.",
    },
  ];
  const tarjetaGuiaCiclo = !hayCaptura && !guiaCicloOculta
    ? <GuiaCiclo pasos={pasosGuiaCiclo} onOcultar={() => setGuiaCicloOculta(true)} />
    : null;

  const tarjetaPorHacer = (
    <PorHacerLabores ordenes={ordenesLabor} parcelas={parcelas} insumos={insumos}
      puedeLabores={puedeLabores} puedeOrdenar={puedeOrdenar}
      onHecha={(l) => { cerrar(); setRapida({ orden: l }); }}
      onOrdenar={() => { setRapida(null); setForm({ tipo: "orden", item: null }); }}
      onEditar={(l) => { setRapida(null); setForm({ tipo: "orden", item: l }); }}
      onEliminar={eliminarLabor} />
  );

  return (
    <div style={{ minHeight: "100vh", background: C.papel, color: C.tinta, fontFamily: fuente.cuerpo }}>
      {guia ? <Onboarding forzar={profile.onboardingHecho} onCerrar={() => setGuia(false)} /> : null}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${C.hoja}; outline-offset: 1px; }
        input[type=range] { accent-color: ${C.bosque}; }
        @media (max-width: 768px) {
          input:not([type=checkbox]):not([type=range]), select, textarea { font-size: 16px !important; min-height: 44px; }
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <header className={`flex items-center justify-between gap-2 px-3 md:px-8 py-3 md:py-4 ${rol === "Encargado de campo" ? "flex-nowrap" : "flex-wrap"}`} style={{ background: C.bosque, color: C.blanco }}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 10, background: C.grano }}>
            <Sprout size={20} color={C.bosque} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, lineHeight: 1 }}>AgroCiclo</div>
            <div className="hidden md:block" style={{ fontSize: 11, opacity: 0.75 }}>El costo real de tu siembra · Valle del Fuerte</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select value={CICLO_ID} onChange={(e) => { void setCiclo(e.target.value); setVista(rol === "Encargado de campo" ? "captura" : "panel"); cerrar(); setRapida(null); setGuiaCicloOculta(false); }}
            title="Ciclo de siembra"
            aria-label="Ciclo de siembra"
            style={{ ...estiloInput, width: "auto", maxWidth: rol === "Encargado de campo" ? 118 : 220, background: "rgba(255,255,255,0.12)", color: C.blanco, border: "1px solid rgba(255,255,255,0.3)", fontWeight: 600, fontSize: 12 }}>
            {ciclos.map(t => <option key={t.id} value={t.id} style={{ color: C.tinta }}>{etiquetaCiclo(t, rol === "Encargado de campo")}</option>)}
          </select>
          {rol === "Dueño" && (
            <button
              type="button"
              onClick={() => { setVista("ajustes"); cerrar(); }}
              title="Ajustes del predio"
              aria-label="Ajustes"
              style={{ ...estiloInput, width: "auto", minWidth: 44, minHeight: 44, background: vista === "ajustes" ? C.grano : "rgba(255,255,255,0.08)", color: vista === "ajustes" ? C.bosque : C.blanco, border: "1px solid rgba(255,255,255,0.25)", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <SlidersHorizontal size={15} /> <span className="hidden md:inline">Ajustes</span>
            </button>
          )}
          <div className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600 }}>
            <AyudaBoton />
            <span className="hidden md:inline" style={{ opacity: 0.9, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.displayName || user?.primaryEmail || "Cuenta"} · {rol}
            </span>
            <button
              type="button"
              onClick={() => void salirAgro()}
              title="Salir"
              aria-label="Salir"
              style={{ ...estiloInput, width: "auto", minWidth: 44, minHeight: 44, background: "rgba(255,255,255,0.08)", color: C.blanco, border: "1px solid rgba(255,255,255,0.25)", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <LogOut size={15} /> <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <nav className="hidden md:flex flex-col gap-1 p-3" style={{ width: 210, borderRight: `1px solid ${C.linea}`, minHeight: "calc(100vh - 68px)" }}>
          {NAV_GRUPOS.map((g) => {
            const items = g.ids.map((id) => NAV.find((n) => n.id === id)).filter(Boolean);
            if (items.length === 0) return null;
            return (
              <div key={g.etiqueta || "inicio"} className="flex flex-col gap-0.5">
                {g.etiqueta ? (
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gris, padding: "12px 12px 4px" }}>
                    {g.etiqueta}
                  </div>
                ) : null}
                {items.map((item) => {
                  const Ic = item.icono; const activo = vista === item.id;
                  return (
                    <button key={item.id} onClick={() => { setVista(item.id); cerrar(); }}
                      className="flex items-center gap-2.5 text-left transition-colors"
                      style={{ padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: activo ? C.bosque : "transparent", color: activo ? C.blanco : C.tinta, fontWeight: activo ? 700 : 500, fontSize: 14, fontFamily: fuente.cuerpo }}>
                      <Ic size={17} /> {item.nombre}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {rol === "Consulta" && <div style={{ fontSize: 11, color: C.gris, padding: "10px 12px" }}>Modo consulta: solo lectura.</div>}
          {rol === "Encargado de campo" && <div style={{ fontSize: 11, color: C.gris, padding: "10px 12px" }}>Vista de campo: sin información financiera.</div>}
        </nav>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 min-w-0 overflow-x-auto" style={{ maxWidth: 1100 }}>

          {/* ===== CAPTURA DE CAMPO ===== */}
          <VistaHoy {...{ vista, nombreCiclo, parcelasT, rol, setVista, tarjetaRapida, tarjetaOrden, tarjetaPorHacer, solicitudesT, setForm, laboresHechas, nominaT, boletasT, parcelas, puedeLabores, cerrar, setRapida, accionRapida }} />

          {/* ===== PANEL ===== */}
          <VistaCiclo {...{ vista, nombreCiclo, puedeEditar, accionRapida, veFinanzas, parcelasT, tarjetaGuiaCiclo, setVista, cajaSaldo, creditosT, dispuestoLinea, ingresoRealTotal, presupuestoCiclo, inversionTotal, avisos, haTotal, costoFinTotal, ingresoTotal, rayaPendiente, dieselIns, laboresHechas, boletasT, cerrar, rol, grupoCargos, grupoAbonos, costosParcela }} />

          {/* ===== PARCELAS ===== */}
          <VistaParcelas {...{ vista, puedeEditar, form, setForm, cerrar, productores, creditosT, guardarParcela, parcelasT, costosParcela, veFinanzas, eliminarParcela, laboresHechas, pagarRenta, dispSinLiquidar, cultivos, agregarCultivo }} />

          {/* ===== LABORES ===== */}
          <VistaLabores {...{ vista, puedeEditar, form, setForm, cerrar, parcelasT, insumos, veFinanzas, guardarLabor, laboresT, parcelas, tarjetaRapida, tarjetaOrden, tarjetaPorHacer, laboresHechas, eliminarLabor, tiposLabor, agregarTipoLabor, guardarLaborRepetir }} />

          {/* ===== INVENTARIO / COMPRAS ===== */}
          <VistaInsumos {...{ vista, puedeEditar, veFinanzas, form, setForm, cerrar, insumos, productores, creditosT, guardarCompra, stockQ, insumosAlmacen, movInvQ, comprasT, marcarPagada, eliminarCompra }} />

          {/* ===== CUADRILLAS / RAYA ===== */}
          <VistaRaya {...{ vista, puedeEditar, form, setForm, cerrar, parcelasT, directorio, guardarNomina, rayaPorPersona, rayaPendiente, pagarRayaPersona, nominaT, parcelas, eliminarNomina, actividadesRaya, agregarActividadRaya }} />

          {/* ===== COSECHA ===== */}
          <VistaCosecha {...{ vista, puedeEditar, form, setForm, cerrar, parcelasT, veFinanzas, guardarBoleta, boletasT, ingresoRealTotal, inversionTotal, costosParcela, parcelas, eliminarBoleta }} />

          {/* ===== SOLICITUDES DE COMPRA (pipeline) ===== */}
          <VistaSolicitudes {...{ vista, puedeEditar, form, setForm, cerrar, insumos, parcelasT, guardarSolicitud, solicitudesT, creditosT, productores, veFinanzas, vePrecios, eliminarSolicitud, agregarCotizacion, eliminarCotizacion, autorizarSolicitud, recibirSolicitud }} />

          {/* ===== PRODUCTORES / PRESTANOMBRES ===== */}
          <VistaProductores {...{ vista, veFinanzas, puedeEditar, setForm, formRef, form, cerrar, guardarProductor, productores, creditosT, guardarDispersion, guardarPrestamo, grupoCargos, grupoAbonos, prestamosT, parcelasT, dispSinLiquidar, eliminarPrestamo, liquidarPrestamo, agregarAplicacion, eliminarAplicacion, productoresQ, cuentasProductor, dispuestoLinea, costoFinLineaA, eliminarProductor, dispersionesT, eliminarDispersion }} />

          {/* ===== GASTOS GENERALES ===== */}
          <VistaGastos {...{ vista, veFinanzas, puedeEditar, form, setForm, cerrar, parcelasT, productores, creditosT, guardarGasto, gastosProrrateo, gastosIndPorHa, gastosT, gastosGenerales, parcelas, eliminarGasto }} />

          {/* ===== CAJA CHICA ===== */}
          <VistaCaja {...{ vista, veFinanzas, puedeEditar, form, setForm, cerrar, creditosT, guardarCajaFondeo, parcelasT, guardarCajaSalida, cajaFondeado, cajaGastado, cajaSaldo, cajaPorAutorizar, cajaMovsT, parcelas, autorizarCajaSalida, eliminarCajaMov }} />

          {/* ===== FINANCIAMIENTO ===== */}
          <VistaCredito {...{ vista, veFinanzas, puedeEditar, form, setForm, cerrar, productores, guardarCredito, costoFinTotal, deudaViva, creditosT, dispsDeLinea, interesLineaA, eliminarCredito, comprasT, marcarPagada, parcelasT, pagarRenta }} />

          {/* ===== COSTO FINANCIERO (desglose por disposición + simulador de fecha) ===== */}
          <VistaCostoFin {...{ vista, veFinanzas, fechaObjetivo, pagoSupuesto, creditosT, dispsDeLinea, interesInsoluto, comprasT, gastosT, parcelasT, interesDisp, setPagoSupuesto, abonoMonto, puedeEditar, revertirLiquidacion, setAbonoMonto, liquidarDisposicion, setFechaObjetivo }} />

          {/* ===== REPORTES + SIMULADOR ===== */}
          <VistaReportes {...{ vista, veFinanzas, parcelasT, costosParcela, inversionTotal, ingresoTotal, laboresHechas, nominaT, insumos, gastosT, apsProductivas, prestamosT, productores, costoFinTotal, costoDirectoTotal, gastosIndTotal, ingresoRealTotal, rentaTotal, haTotal, dieselUsado, dieselCosto }} />

          <VistaAjustes {...{ vista, rol, setGuia, user, profile, guardarAjustes, regenerarCodigo, ciclos, CICLO_ID, setCiclo, setVista, reload, insumos, guardarInsumo, eliminarInsumo, vaciar, restaurarDemo }} />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around py-1.5" style={{ background: C.blanco, borderTop: `1px solid ${C.linea}` }}>
        {NAV_MOVIL.map(item => {
          const Ic = item.icono; const activo = vista === item.id;
          return (
            <button key={item.id} onClick={() => { setVista(item.id); cerrar(); }}
              className="flex flex-col items-center gap-0.5 flex-1"
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: "8px 6px", minHeight: 52, color: activo ? C.bosque : C.gris, fontWeight: activo ? 700 : 500, fontSize: 11, fontFamily: fuente.cuerpo }}>
              <Ic size={20} /> {item.nombre}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function AgroCiclo() {
  return <ErrorBoundary><AgroCicloApp /></ErrorBoundary>;
}


































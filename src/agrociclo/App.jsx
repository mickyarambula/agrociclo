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
  ESTADOS_SOLICITUD, ORDEN_ESTADO, TIPOS_LABOR,
} from "./base";
import {
  fuente, estiloInput, etiquetaCiclo,
  Tarjeta, Etiqueta, Boton, Campo, PickerParcela, Acciones, ErrorBoundary,
  BarraLista, Seccion, Fila, Vacio, useForm,
} from "./ui";
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
        onGuardar={(f) => guardarLaborMut.mutate({ f, original: rapida.orden }, { onSuccess: () => setRapida(null) })}
        onCancelar={() => setRapida(null)} />
    </Tarjeta>
  ) : null;
  const tarjetaOrden = form?.tipo === "orden" ? (
    <Tarjeta style={{ padding: 16, borderTop: `3px solid ${C.grano}` }}>
      <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
        {form.item ? "Editar orden" : "Ordenar labor"}
      </div>
      <FormOrdenLabor key={form.item?.id || "nueva"} inicial={form.item} parcelas={parcelasT} insumos={insumos}
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
          {vista === "captura" && (
            <div className="flex flex-col gap-4">
              <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 26, margin: 0 }}>Tarja de hoy</h1>
              <p style={{ margin: 0, fontSize: 14, color: C.gris }}>
                {nombreCiclo}. Lo que pasó en el lote, en tres toques. La oficina ve montos.
              </p>
              {parcelasT.length === 0 ? (
                <Tarjeta style={{ padding: 28, textAlign: "center" }}>
                  <Sprout size={36} color={C.hoja} className="mx-auto" />
                  <p style={{ fontWeight: 600, marginTop: 12 }}>Este ciclo todavía no tiene parcelas.</p>
                  <p style={{ fontSize: 13, color: C.gris, marginTop: 6 }}>
                    El Dueño da de alta los lotes en Parcelas. Mientras tanto no hay labores ni boletas que capturar.
                  </p>
                  {rol === "Dueño" || rol === "Oficina" ? (
                    <div className="flex justify-center mt-3"><Boton onClick={() => setVista("parcelas")}>Ir a Parcelas <ChevronRight size={15} /></Boton></div>
                  ) : null}
                </Tarjeta>
              ) : (
                <>
                  {tarjetaRapida}
                  {tarjetaOrden}
                  {tarjetaPorHacer}
                  {(() => {
                    const pedidos = solicitudesT.filter((s) => s.estado !== "recibido" && s.estado !== "cancelado");
                    if (pedidos.length === 0) return null;
                    return (
                      <Tarjeta style={{ padding: 16 }}>
                        <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                          Pedidos de insumo · {pedidos.length}
                        </div>
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: C.gris }}>Compras que la oficina pidió o autorizó. Se reciben en Solicitudes.</p>
                        {pedidos.slice(0, 6).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setVista("solicitudes"); setForm({ tipo: "solicitud", item: s }); }}
                            className="flex w-full items-center justify-between gap-2 text-left"
                            style={{ fontSize: 13, padding: "10px 0", borderTop: `1px solid ${C.linea}`, background: "transparent", borderLeft: "none", borderRight: "none", borderBottom: "none", cursor: "pointer", minHeight: 44, color: C.tinta, fontFamily: fuente.cuerpo }}
                          >
                            <span>
                              <strong>{s.insumoNombre || "Insumo"}</strong>
                              <span style={{ color: C.gris }}> · {s.cantidad} {s.unidad}</span>
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.bosque }}>{s.estado}</span>
                          </button>
                        ))}
                      </Tarjeta>
                    );
                  })()}
                  {(() => {
                    const hoyLab = laboresHechas.filter((l) => l.fecha === hoyStr);
                    const hoyRay = nominaT.filter((n) => n.fecha === hoyStr);
                    const hoyBol = boletasT.filter((b) => b.fecha === hoyStr);
                    const n = hoyLab.length + hoyRay.length + hoyBol.length;
                    if (n === 0) {
                      return <Vacio texto="Hoy todavía no hay registros. El primero del día sale en un toque." />;
                    }
                    return (
                      <Tarjeta style={{ padding: 16 }}>
                        <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Hecho hoy · {n}</div>
                        {hoyLab.map((l) => {
                          const p = parcelas.find((x) => x.id === l.parcelaId);
                          return <div key={l.id} style={{ fontSize: 13, padding: "8px 0", borderTop: `1px solid ${C.linea}` }}>{l.tipo} · {p?.nombre || "parcela"} · {l.desc || "sin nota"}</div>;
                        })}
                        {hoyRay.map((r) => (
                          <div key={r.id} style={{ fontSize: 13, padding: "8px 0", borderTop: `1px solid ${C.linea}` }}>Raya · {r.cuadrilla} · {r.actividad}</div>
                        ))}
                        {hoyBol.map((b) => (
                          <div key={b.id} style={{ fontSize: 13, padding: "8px 0", borderTop: `1px solid ${C.linea}` }}>Boleta {b.boleta || "s/n"} · {num(calcBoleta(b).pagable, 0)} kg</div>
                        ))}
                      </Tarjeta>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "labor", vista: "labores", titulo: "Labor", desc: "Riego, rastreo, aplicación", Ic: Tractor },
                      { id: "nomina", vista: "cuadrillas", titulo: "Raya", desc: "Jornales del día", Ic: Users },
                      { id: "boleta", vista: "cosecha", titulo: "Boleta", desc: "Entrega en bodega", Ic: Wheat },
                      { id: "solicitud", vista: "solicitudes", titulo: "Solicitud", desc: "Pedir insumo", Ic: ClipboardList },
                    ].map((a) => {
                      const Ic = a.Ic;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            if (a.id === "labor" && puedeLabores) { cerrar(); setRapida({ orden: null }); return; }
                            accionRapida(a.vista, a.id);
                          }}
                          className="text-left"
                          style={{
                            background: C.blanco, border: `1px solid ${C.linea}`, borderTop: `3px solid ${C.bosque}`,
                            borderRadius: 14, padding: 16, minHeight: 108, cursor: "pointer",
                            fontFamily: fuente.cuerpo, color: C.tinta,
                          }}
                        >
                          <Ic size={22} color={C.bosque} />
                          <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, marginTop: 8 }}>{a.titulo}</div>
                          <div style={{ fontSize: 12, color: C.gris }}>{a.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== PANEL ===== */}
          {vista === "panel" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 26, margin: 0 }}>
                  {nombreCiclo}
                </h1>
                {puedeEditar && (
                  <div className="flex gap-2 flex-wrap">
                    <Boton chico secundario onClick={() => accionRapida("labores", "labor")}><Plus size={13} /> Labor</Boton>
                    {veFinanzas && <Boton chico secundario onClick={() => accionRapida("inventario", "compra")}><Plus size={13} /> Compra</Boton>}
                    <Boton chico secundario onClick={() => accionRapida("solicitudes", "solicitud")}><Plus size={13} /> Solicitud</Boton>
                    <Boton chico secundario onClick={() => accionRapida("cuadrillas", "nomina")}><Plus size={13} /> Trabajo</Boton>
                    <Boton chico secundario onClick={() => accionRapida("cosecha", "boleta")}><Plus size={13} /> Boleta</Boton>
                  </div>
                )}
              </div>

              {parcelasT.length === 0 ? (
                tarjetaGuiaCiclo || (
                  <Tarjeta style={{ padding: 32, textAlign: "center" }}>
                    <Sprout size={36} color={C.hoja} className="mx-auto" />
                    <p style={{ fontWeight: 600, marginTop: 12 }}>Esta temporada todavía no tiene parcelas.</p>
                    <div className="flex justify-center mt-3"><Boton onClick={() => setVista("parcelas")}>Ir a Parcelas <ChevronRight size={15} /></Boton></div>
                  </Tarjeta>
                )
              ) : (
                <>
                  {tarjetaGuiaCiclo}
                  {/* ===== TIRA DE PLATA: el pulso del dinero en una franja ===== */}
                  {veFinanzas && (
                    <Tarjeta style={{ padding: "12px 16px", background: C.bosque }}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { l: "Caja chica", v: money(cajaSaldo) },
                          { l: "Crédito dispuesto", v: money(creditosT.reduce((s, cr) => s + dispuestoLinea(cr), 0)) },
                          { l: "Vendido", v: money(ingresoRealTotal) },
                          { l: "Presupuesto", v: presupuestoCiclo > 0 ? `${num((inversionTotal / presupuestoCiclo) * 100, 0)}% usado` : "Sin fijar" },
                        ].map((k) => (
                          <div key={k.l}>
                            <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>{k.l}</div>
                            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 17, color: C.blanco }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                    </Tarjeta>
                  )}

                  {avisos.length > 0 && (
                    <Tarjeta style={{ padding: 16 }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Bell size={15} color={C.barrial} />
                        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Avisos ({avisos.length})</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {avisos.map((a, i) => (
                          <div key={i} className="flex items-start gap-2" style={{ fontSize: 13 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, marginTop: 5, flexShrink: 0, background: a.nivel === "rojo" ? C.rojo : a.nivel === "ambar" ? C.grano : C.hoja }} />
                            <span style={{ color: a.nivel === "rojo" ? C.rojo : C.tinta, fontWeight: a.nivel === "rojo" ? 600 : 400 }}>{a.texto}</span>
                          </div>
                        ))}
                      </div>
                    </Tarjeta>
                  )}

                  {/* tarjetas-botón: tocar te lleva al detalle */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {(veFinanzas ? [
                      { l: "Inversión total", v: money(inversionTotal), s: `${num(haTotal, 0)} ha · toca para el desglose`, ir: "reportes" },
                      { l: "Costo financiero", v: money(costoFinTotal), s: "Avíos + compras + rentas", ir: "credito", alerta: true },
                      { l: "Ingreso cosechado", v: money(ingresoRealTotal), s: ingresoRealTotal > 0 ? `de ${money(ingresoTotal)} esperado` : "Aún sin entregas", ir: "cosecha" },
                      { l: "Raya por pagar", v: money(rayaPendiente), s: rayaPendiente > 0 ? "Toca para hacer el corte" : "Al corriente", ir: "cuadrillas", alerta: rayaPendiente > 0 },
                    ] : [
                      { l: "Diésel en tanque", v: `${num(dieselIns?.stock || 0, 0)} L`, s: "Toca para ver almacén", ir: "inventario" },
                      { l: "Raya por pagar", v: money(rayaPendiente), s: "Toca para el corte", ir: "cuadrillas", alerta: rayaPendiente > 0 },
                      { l: "Labores registradas", v: num(laboresHechas.length, 0), s: "Toca para ver o capturar", ir: "labores" },
                      { l: "Entregas a bodega", v: num(boletasT.length, 0), s: "Toca para registrar boleta", ir: "cosecha" },
                    ]).map((k, i) => (
                      <Tarjeta key={i} onClick={() => { setVista(k.ir); cerrar(); }}
                        style={{ padding: 16, borderTop: k.alerta ? `3px solid ${C.grano}` : `3px solid ${C.bosque}` }}>
                        <div className="flex items-center justify-between">
                          <Etiqueta>{k.l}</Etiqueta>
                          <ChevronRight size={14} color={C.gris} />
                        </div>
                        <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 22, marginTop: 4 }}>{k.v}</div>
                        <div style={{ fontSize: 12, color: k.alerta ? C.barrial : C.gris, fontWeight: k.alerta ? 700 : 400 }}>{k.s}</div>
                      </Tarjeta>
                    ))}
                  </div>

                  {/* ===== La misma cuenta gorda del cierre, aquí en El ciclo ===== */}
                  {veFinanzas && ingresoRealTotal > 0 && (
                    <Tarjeta
                      onClick={() => { setVista("cosecha"); cerrar(); }}
                      style={{ padding: 18, borderTop: `3px solid ${ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo}`, cursor: "pointer" }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>El cierre de la venta</span>
                        <span style={{ fontSize: 12, color: C.gris }}>toca para ver por parcela</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        {[
                          { l: "Vendido", v: money(ingresoRealTotal) },
                          { l: "Costó", v: money(inversionTotal) },
                          { l: "Quedó", v: money(ingresoRealTotal - inversionTotal), c: ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo },
                        ].map((k) => (
                          <div key={k.l}>
                            <Etiqueta>{k.l}</Etiqueta>
                            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, marginTop: 2, color: k.c || C.tinta }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                    </Tarjeta>
                  )}

                  {veFinanzas && (
                    <Tarjeta style={{ padding: 18 }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Presupuesto vs real</span>
                        {rol === "Dueño" ? (
                          <button
                            type="button"
                            onClick={() => setVista("ajustes")}
                            style={{ border: "none", background: "transparent", color: C.hoja, fontWeight: 600, fontSize: 12, cursor: "pointer", minHeight: 44 }}
                          >
                            Fijar en Ajustes
                          </button>
                        ) : null}
                      </div>
                      {presupuestoCiclo > 0 ? (
                        <>
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            {[
                              { l: "Presupuestado", v: money(presupuestoCiclo) },
                              { l: "Gastado", v: money(inversionTotal) },
                              { l: inversionTotal > presupuestoCiclo ? "Pasado" : "Falta", v: money(Math.abs(presupuestoCiclo - inversionTotal)), c: inversionTotal > presupuestoCiclo ? C.rojo : C.bosque },
                            ].map((k) => (
                              <div key={k.l}>
                                <Etiqueta>{k.l}</Etiqueta>
                                <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, marginTop: 2, color: k.c || C.tinta }}>{k.v}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3" style={{ height: 10, borderRadius: 99, background: C.papel, border: `1px solid ${C.linea}`, overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${Math.min(100, (inversionTotal / presupuestoCiclo) * 100)}%`,
                              background: inversionTotal > presupuestoCiclo ? C.rojo : C.bosque,
                            }} />
                          </div>
                          <div style={{ fontSize: 12, color: C.gris, marginTop: 6 }}>
                            {num((inversionTotal / presupuestoCiclo) * 100, 0)}% del presupuesto · {num(haTotal, 0)} ha
                          </div>
                        </>
                      ) : (
                        <p style={{ margin: "8px 0 0", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                          Aún no hay presupuesto de este ciclo. El Dueño lo pone en Ajustes → Ciclos. El gastado va aquí: {money(inversionTotal)}.
                        </p>
                      )}
                    </Tarjeta>
                  )}

                  {veFinanzas && grupoCargos > 0 && (
                    <Tarjeta onClick={() => { setVista("productores"); cerrar(); }}
                      style={{ padding: 16, borderTop: `3px solid ${C.azul}`, cursor: "pointer" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Grupo · saldo por liquidar a cosecha</span>
                        <ChevronRight size={14} color={C.gris} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { l: "Dispersado", v: money(grupoCargos), c: C.barrial },
                          { l: "Abonado (boletas)", v: money(grupoAbonos), c: C.hoja },
                          { l: "Por liquidar", v: money(grupoCargos - grupoAbonos), c: grupoCargos - grupoAbonos > 0 ? C.rojo : C.bosque },
                        ].map(k => (
                          <div key={k.l}>
                            <Etiqueta>{k.l}</Etiqueta>
                            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, color: k.c, marginTop: 2 }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: C.gris, marginTop: 6 }}>Toca para ver estado de cuenta por productor</div>
                    </Tarjeta>
                  )}

                  {veFinanzas && (
                    <Tarjeta style={{ padding: 20 }}>
                      <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Costo por hectárea — completo, no optimista</span>
                      <div className="flex flex-col gap-4 mt-3">
                        {parcelasT.map(p => {
                          const c = costosParcela[p.id];
                          const maxHa = Math.max(...parcelasT.map(x => costosParcela[x.id].porHa), 1);
                          const directoHa = (c.labores + c.nomina) / p.ha;
                          const rentaHa = c.renta / p.ha;
                          const indHa = c.gastoInd / p.ha;
                          const finHa = c.interes / p.ha;
                          return (
                            <div key={p.id}>
                              <div className="flex justify-between flex-wrap gap-1" style={{ fontSize: 13, fontWeight: 600 }}>
                                <span>{p.cultivo} · {p.nombre}</span><span>{money(c.porHa)}/ha</span>
                              </div>
                              <div className="flex mt-1" style={{ height: 22, borderRadius: 6, overflow: "hidden", background: C.papel, border: `1px solid ${C.linea}` }}>
                                <div style={{ width: `${(directoHa / maxHa) * 100}%`, background: C.hoja }} title="Directo" />
                                <div style={{ width: `${(rentaHa / maxHa) * 100}%`, background: C.barrial }} title="Renta" />
                                <div style={{ width: `${(indHa / maxHa) * 100}%`, background: C.azul }} title="Indirectos" />
                                <div style={{ width: `${(finHa / maxHa) * 100}%`, background: C.grano }} title="Financiero" />
                              </div>
                              <div style={{ fontSize: 11, color: C.gris, marginTop: 2 }}>
                                Directo {money(directoHa)} · Renta {money(rentaHa)} · Indirectos {money(indHa)} · Financiero {money(finHa)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Tarjeta>
                  )}

                  {veFinanzas && (
                    <Tarjeta style={{ padding: 20 }}>
                      <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Proyección vs. realidad</span>
                      <div className="overflow-x-auto mt-3">
                        <table className="w-full" style={{ fontSize: 13, borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ color: C.gris, textAlign: "left" }}>
                              <th className="py-2 pr-3 font-semibold">Parcela</th>
                              <th className="py-2 pr-3 font-semibold">Costo completo</th>
                              <th className="py-2 pr-3 font-semibold">Equilibrio</th>
                              <th className="py-2 pr-3 font-semibold">Cosechado</th>
                              <th className="py-2 font-semibold">Utilidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parcelasT.map(p => {
                              const c = costosParcela[p.id];
                              const enCosecha = c.tonReal > 0;
                              return (
                                <tr key={p.id} style={{ borderTop: `1px solid ${C.linea}` }}>
                                  <td className="py-2.5 pr-3" style={{ fontWeight: 600 }}>{p.cultivo}<div style={{ fontSize: 11, color: C.gris, fontWeight: 400 }}>{p.nombre} · {p.ha} ha</div></td>
                                  <td className="py-2.5 pr-3">{money(c.total)}</td>
                                  <td className="py-2.5 pr-3">{num(c.puntoEq, 2)} ton/ha · {money(c.precioEq)}/ton</td>
                                  <td className="py-2.5 pr-3">{enCosecha ? `${num(c.tonReal, 1)} ton (${num(c.rendReal, 2)}/ha)` : "—"}</td>
                                  <td className="py-2.5" style={{ fontWeight: 700, color: (enCosecha ? c.utilidadReal : c.utilidad) >= 0 ? C.bosque : C.rojo }}>
                                    {enCosecha ? money(c.utilidadReal) : money(c.utilidad)}
                                    <span style={{ fontSize: 10, color: C.gris, fontWeight: 600 }}> {enCosecha ? "real parcial" : "proyectada"}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Tarjeta>
                  )}
                </>
              )}
            </div>
          )}

          {/* ===== PARCELAS ===== */}
          {vista === "parcelas" && (
            <Seccion titulo="Parcelas y cultivos" accion="Nueva parcela" puedeEditar={puedeEditar}
              abierto={form?.tipo === "parcela"} onAbrir={() => setForm({ tipo: "parcela", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormParcela key={form?.item?.id || "nueva"} inicial={form?.item} productores={productores} creditos={creditosT} onGuardar={(f) => guardarParcela(f, form?.item)} />}>
              {parcelasT.length === 0 && <Vacio texto="Sin parcelas en esta temporada." />}
              <div className="grid md:grid-cols-2 gap-3">
                {parcelasT.map(p => {
                  const c = costosParcela[p.id];
                  return (
                    <Tarjeta key={p.id} style={{ padding: 18 }}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 17 }}>{p.cultivo}</div>
                          <div style={{ fontSize: 13, color: C.gris }}>
                            {p.nombre} · {p.ha} ha · <span style={{ fontWeight: 600, color: p.tenencia === "Rentada" ? C.barrial : C.hoja }}>{p.tenencia}{p.tenencia === "Rentada" ? ` ${money(p.rentaPorHa)}/ha` : ""}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {veFinanzas && (
                            <span style={{ background: c.utilidad >= 0 ? "#E8F1E6" : "#F7E8E3", color: c.utilidad >= 0 ? C.bosque : C.rojo, fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 999 }}>
                              {c.utilidad >= 0 ? "Utilidad" : "Pérdida"}
                            </span>
                          )}
                          {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "parcela", item: p })} onEliminar={() => eliminarParcela(p)} />}
                        </div>
                      </div>
                      {veFinanzas ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3" style={{ fontSize: 13 }}>
                          <Fila l="Labores e insumos" v={money(c.labores)} />
                          <Fila l="Jornales" v={money(c.nomina)} />
                          {p.tenencia === "Rentada" && <Fila l="Renta de tierra" v={money(c.renta)} resalta />}
                          <Fila l="Gastos indirectos" v={money(c.gastoInd)} />
                          <Fila l="Costo financiero" v={money(c.interes)} resalta />
                          <Fila l="Costo directo / ha" v={money(c.directoPorHa)} />
                          <Fila l="Costo completo / ha" v={money(c.porHa)} />
                          <Fila l="Equilibrio" v={`${num(c.puntoEq, 2)} ton/ha`} />
                          <Fila l="Precio mínimo" v={`${money(c.precioEq)}/ton`} />
                          <Fila l="Utilidad proy." v={money(c.utilidad)} />
                        </div>
                      ) : (
                        <div className="mt-3" style={{ fontSize: 13, color: C.gris }}>
                          {laboresHechas.filter(l => l.parcelaId === p.id).length} labores registradas · {num(c.tonReal, 1)} ton entregadas
                        </div>
                      )}
                      {veFinanzas && p.tenencia === "Rentada" && p.rentaOrigen === "externo" && !p.fechaPagoRenta && (
                        <div className="flex items-center justify-between gap-2 mt-3" style={{ background: "#FBF4E3", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                          <span style={{ color: C.barrial, fontWeight: 600 }}>Renta financiada aparte al {num(p.tasaRenta, 1)}% · interés {money(rentaInteres(p))}</span>
                          {puedeEditar && <Boton chico secundario onClick={() => pagarRenta(p)}><CheckCircle2 size={13} /> Renta pagada</Boton>}
                        </div>
                      )}
                      {veFinanzas && p.tenencia === "Rentada" && p.rentaOrigen === "linea" && (
                        dispSinLiquidar(p.rentaOrigen, p.fechaPagoRenta, p.disposicionId)
                          ? <div className="mt-3 flex items-center gap-2" style={{ background: "#FBF4E3", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.barrial }}>
                              <span style={{ fontWeight: 700 }}>● Disposición sin liquidar</span>
                              <span style={{ color: C.gris }}>· renta pagada al productor, pero su disposición sigue sin liquidar en Costo financiero.</span>
                            </div>
                          : <div className="mt-3" style={{ background: "#EEF2E6", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.bosque }}>
                              Renta sobre línea registrada · su interés ya corre en la línea, no se cuenta aparte.
                            </div>
                      )}
                    </Tarjeta>
                  );
                })}
              </div>
            </Seccion>
          )}

          {/* ===== LABORES ===== */}
          {vista === "labores" && (
            <Seccion titulo="Labores y aplicaciones" accion="Registrar labor" puedeEditar={puedeEditar}
              abierto={form?.tipo === "labor"} onAbrir={() => setForm({ tipo: "labor", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormLabor key={form?.item?.id || "nueva"} inicial={form?.item} parcelas={parcelasT} insumos={insumos} veFinanzas={veFinanzas} onGuardar={(f) => guardarLabor(f, form?.item)} />}>

              <TareasWhatsApp labores={laboresT} parcelas={parcelas} insumos={insumos} />

              {tarjetaRapida}
              {tarjetaOrden}
              {tarjetaPorHacer}

              {laboresHechas.length === 0 && <Vacio texto="Aún no hay labores registradas en esta temporada." />}
              {laboresHechas.length > 0 && (
                <Tarjeta>
                  {laboresHechas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((l, i) => {
                    const p = parcelas.find(x => x.id === l.parcelaId);
                    const ins = l.insumoId ? insumos.find(x => x.id === l.insumoId) : null;
                    return (
                      <div key={l.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{l.tipo} <span style={{ color: C.gris, fontWeight: 400 }}>· {p?.cultivo} ({p?.nombre})</span></div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {l.fecha} · {l.desc}
                            {ins ? ` · ${num(l.cantidad, 1)} ${ins.unidad} ${ins.nombre}` : ""}
                            {l.litrosDiesel ? ` · ${num(l.litrosDiesel, 0)} L diésel${veFinanzas ? ` (${money(l.costoDiesel)})` : ""}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {veFinanzas && (
                            <div style={{ fontWeight: 700, fontSize: 14, color: costoLabor(l) > 0 ? C.tinta : C.barrial }}>
                              {costoLabor(l) > 0 ? money(costoLabor(l)) : "sin costo"}
                            </div>
                          )}
                          {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "labor", item: l })} onEliminar={() => eliminarLabor(l)} />}
                        </div>
                      </div>
                    );
                  })}
                </Tarjeta>
              )}
            </Seccion>
          )}

          {/* ===== INVENTARIO / COMPRAS ===== */}
          {vista === "inventario" && (
            <Seccion titulo="Insumos y compras" accion="Registrar compra" puedeEditar={puedeEditar && veFinanzas}
              abierto={form?.tipo === "compra"} onAbrir={() => setForm({ tipo: "compra", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormCompra key={form?.item?.id || "nueva"} inicial={form?.item} insumos={insumos} productores={productores} creditos={creditosT} onGuardar={(f) => guardarCompra(f, form?.item)} />}>
              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Almacén</div>
              {(stockQ.data ?? []).length === 0 ? (
                <Vacio texto="Bodega vacía. La compra entra aquí; la labor lo baja. Empieza con “Registrar compra”." />
              ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {insumosAlmacen.map(ins => (
                  <Tarjeta key={ins.id} style={{ padding: 16, borderLeft: ins.categoria === "Diésel" ? `3px solid ${C.barrial}` : undefined }}>
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5" style={{ fontWeight: 600, fontSize: 14 }}>
                          {ins.categoria === "Diésel" && <Fuel size={14} color={C.barrial} />}{ins.nombre}
                        </div>
                        <div style={{ fontSize: 12, color: C.gris }}>{ins.categoria} · {money(ins.costoUnitario)} / {ins.unidad}</div>
                      </div>
                      <div className="text-right">
                        <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, color: ins.stock <= 2 ? C.rojo : C.bosque }}>{num(ins.stock, 1)}</div>
                        <div style={{ fontSize: 11, color: C.gris }}>{ins.unidad} en {ins.categoria === "Diésel" ? "tanque" : "bodega"}</div>
                      </div>
                    </div>
                    {ins.stock <= 2 && (
                      <div className="flex items-center gap-1.5 mt-2" style={{ fontSize: 12, color: C.rojo, fontWeight: 600 }}>
                        <AlertTriangle size={13} /> Stock bajo, planea recompra
                      </div>
                    )}
                  </Tarjeta>
                ))}
              </div>
              )}

              {(movInvQ.data ?? []).length > 0 && (
                <>
                  <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Movimientos · compra entra, labor sale</div>
                  <Tarjeta>
                    {(movInvQ.data ?? []).slice(0, 20).map((m, i) => {
                      const ins = Array.isArray(m.insumo) ? m.insumo[0] : m.insumo;
                      const nombre = ins?.nombre || "Insumo";
                      const unidad = ins?.unidad || "";
                      const entra = m.tipo !== "salida";
                      const origen = m.origen_tipo === "labor" ? "labor" : m.origen_tipo === "compra" ? "compra" : (m.origen_tipo || "");
                      return (
                        <div key={m.id} className="flex justify-between items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? `1px solid ${C.linea}` : "none", fontSize: 13 }}>
                          <div>
                            <span style={{ fontWeight: 700, color: entra ? C.bosque : C.barrial }}>{entra ? "Entró" : "Salió"}</span>
                            {" · "}{nombre}
                            <span style={{ color: C.gris }}> · {origen} · {m.fecha}</span>
                          </div>
                          <div style={{ fontWeight: 700, color: entra ? C.bosque : C.barrial }}>
                            {entra ? "+" : "−"}{num(Number(m.cantidad) || 0, 1)} {unidad}
                          </div>
                        </div>
                      );
                    })}
                  </Tarjeta>
                </>
              )}

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Historial de compras</div>
              {comprasT.length === 0 && <Vacio texto="Sin compras registradas." />}
              {comprasT.length > 0 && (
                <Tarjeta>
                  {comprasT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((cp, i) => (
                    <div key={cp.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {cp.insumoNombre} <span style={{ color: C.gris, fontWeight: 400 }}>· {num(cp.cantidad, 1)} {cp.unidad} · {cp.proveedor}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.gris }}>
                          {cp.fecha} · {cp.origen === "externo"
                            ? <span style={{ color: C.barrial, fontWeight: 600 }}>Crédito de proveedor {num(cp.tasa, 1)}% · interés {money(interesCompra(cp))} {cp.fechaPago ? `· pagada el ${cp.fechaPago}` : "· corriendo"}</span>
                            : cp.origen === "linea"
                              ? <span style={{ color: C.hoja, fontWeight: 600 }}>Sobre línea: {creditosT.find(c => c.id === cp.creditoId)?.fuente || "—"} · sin interés aparte</span>
                              : "Recurso propio"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{money(cp.monto)}</div>
                        {puedeEditar && cp.origen === "externo" && !cp.fechaPago && (
                          <Boton chico secundario onClick={() => marcarPagada(cp)}><CheckCircle2 size={13} /> Marcar pagada</Boton>
                        )}
                        {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "compra", item: cp })} onEliminar={() => eliminarCompra(cp)} />}
                      </div>
                    </div>
                  ))}
                </Tarjeta>
              )}
            </Seccion>
          )}

          {/* ===== CUADRILLAS / RAYA ===== */}
          {vista === "cuadrillas" && (
            <Seccion titulo="Cuadrillas y operadores · lista de raya" accion="Registrar trabajo" puedeEditar={puedeEditar}
              abierto={form?.tipo === "nomina"} onAbrir={() => setForm({ tipo: "nomina", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormNomina key={form?.item?.id || "nueva"} inicial={form?.item} parcelas={parcelasT} directorio={directorio} onGuardar={(f) => guardarNomina(f, form?.item)} />}>

              {rayaPorPersona.length > 0 && (
                <Tarjeta style={{ padding: 18, borderTop: `3px solid ${C.grano}` }}>
                  <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Corte de raya · {money(rayaPendiente)} pendiente</div>
                  <div className="flex flex-col mt-2">
                    {rayaPorPersona.map((r, i) => (
                      <div key={r.nombre} className="flex justify-between items-center gap-3 py-2.5 flex-wrap" style={{ borderTop: i ? `1px dashed ${C.linea}` : "none" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.nombre} <span style={{ background: "#EEF2E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{r.tipo}</span></div>
                          <div style={{ fontSize: 12, color: C.gris }}>{r.jornales} jornales en {r.registros} registro(s)</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 17 }}>{money(r.total)}</div>
                          {puedeEditar && <Boton chico onClick={() => pagarRayaPersona(r.nombre)}><CheckCircle2 size={13} /> Pagar raya</Boton>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Tarjeta>
              )}

              {nominaT.length === 0 && <Vacio texto="Sin jornales registrados esta temporada." />}
              {nominaT.length > 0 && (
                <Tarjeta>
                  {nominaT.slice().sort((a, b) => (a.pagado === b.pagado ? b.fecha.localeCompare(a.fecha) : a.pagado ? 1 : -1)).map((n, i) => {
                    const p = parcelas.find(x => x.id === n.parcelaId);
                    const jornales = n.personas * n.dias;
                    return (
                      <div key={n.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap" style={{ fontWeight: 600, fontSize: 14 }}>
                            {n.cuadrilla}
                            {!n.pagado
                              ? <span style={{ background: "#FBF4E3", color: C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Por pagar</span>
                              : <span style={{ background: "#E8F1E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Pagado {n.fechaPago || ""}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {n.fecha} · {n.actividad} · {p?.cultivo} ({p?.nombre}) · {n.personas} × {n.dias} día(s) = {jornales} jornales × {money(n.pago)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{money(jornales * n.pago)}</div>
                          {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "nomina", item: n })} onEliminar={() => eliminarNomina(n)} />}
                        </div>
                      </div>
                    );
                  })}
                </Tarjeta>
              )}
            </Seccion>
          )}

          {/* ===== COSECHA ===== */}
          {vista === "cosecha" && (
            <Seccion titulo="Cosecha · entregas en bodega" accion="Registrar boleta" puedeEditar={puedeEditar}
              abierto={form?.tipo === "boleta"} onAbrir={() => setForm({ tipo: "boleta", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormBoleta key={form?.item?.id || "nueva"} inicial={form?.item} parcelas={parcelasT} veFinanzas={veFinanzas} onGuardar={(f) => guardarBoleta(f, form?.item)} />}>

              {/* ===== EL CIERRE: la cuenta que el productor quiere ver ===== */}
              {veFinanzas && boletasT.length > 0 && (
                <Tarjeta style={{ padding: 20, borderTop: `4px solid ${ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo}` }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 17 }}>El cierre de la venta</span>
                    <span style={{ fontSize: 12, color: C.gris }}>con lo entregado hasta hoy · todo el ciclo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {[
                      { l: "Vendido", v: money(ingresoRealTotal), s: `${num(Object.values(costosParcela).reduce((s, c) => s + c.tonReal, 0), 1)} ton entregadas` },
                      { l: "Costó", v: money(inversionTotal), s: "labores + insumos + raya + renta + gastos + financiero" },
                      { l: "Quedó", v: money(ingresoRealTotal - inversionTotal), c: ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo, s: ingresoRealTotal - inversionTotal >= 0 ? "hasta hoy vas arriba" : "aún no cubres el costo" },
                    ].map((k) => (
                      <div key={k.l}>
                        <Etiqueta>{k.l}</Etiqueta>
                        <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 22, marginTop: 2, color: k.c || C.tinta }}>{k.v}</div>
                        <div style={{ fontSize: 11, color: C.gris }}>{k.s}</div>
                      </div>
                    ))}
                  </div>
                </Tarjeta>
              )}

              <div className="grid md:grid-cols-3 gap-3">
                {parcelasT.map(p => {
                  const c = costosParcela[p.id];
                  if (!c || c.tonReal === 0) return null;
                  const avance = p.rendEsperado > 0 ? (c.rendReal / p.rendEsperado) * 100 : 0;
                  return (
                    <Tarjeta key={p.id} style={{ padding: 16, borderTop: `3px solid ${C.hoja}` }}>
                      <Etiqueta>{p.cultivo} · {p.nombre}</Etiqueta>
                      <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, marginTop: 4 }}>{num(c.tonReal, 1)} ton</div>
                      <div style={{ fontSize: 12, color: C.gris }}>{num(c.rendReal, 2)} ton/ha · {num(avance, 0)}% de lo esperado</div>
                      <div style={{ height: 8, borderRadius: 4, background: C.papel, border: `1px solid ${C.linea}`, marginTop: 6 }}>
                        <div style={{ width: `${Math.min(100, avance)}%`, height: "100%", borderRadius: 4, background: C.hoja }} />
                      </div>
                      {veFinanzas && (
                        <div className="mt-2" style={{ fontSize: 12 }}>
                          <Fila l="Vendido" v={money(c.ingresoReal)} />
                          <Fila l="Costó (todo el lote)" v={money(c.total)} />
                          <Fila l="Quedó hasta hoy" v={money(c.utilidadReal)} resalta />
                        </div>
                      )}
                    </Tarjeta>
                  );
                })}
              </div>

              {boletasT.length === 0 && <Vacio texto="Sin entregas registradas." />}
              {boletasT.length > 0 && (
                <Tarjeta>
                  {boletasT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((b, i) => {
                    const p = parcelas.find(x => x.id === b.parcelaId);
                    const c = calcBoleta(b);
                    return (
                      <div key={b.id} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div className="flex justify-between items-center gap-3 flex-wrap">
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              Boleta {b.boleta} · {b.bodega} <span style={{ color: C.gris, fontWeight: 400 }}>· {p?.cultivo} ({p?.nombre})</span>
                            </div>
                            <div style={{ fontSize: 12, color: C.gris }}>
                              {b.fecha} · Neto {num(c.neto, 0)} kg · Hum {num(b.humedad, 1)}% (−{num(c.descH, 0)} kg) · Imp {num(b.impurezas, 1)}% (−{num(c.descI, 0)} kg) → <strong style={{ color: C.tinta }}>{num(c.pagable, 0)} kg</strong>
                              {veFinanzas ? <> × {money(b.precioTon)}/ton</> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {veFinanzas && <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 16, color: C.bosque }}>{money(c.ingresoNeto)}</div>}
                            {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "boleta", item: b })} onEliminar={() => eliminarBoleta(b)} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Tarjeta>
              )}
            </Seccion>
          )}

          {/* ===== SOLICITUDES DE COMPRA (pipeline) ===== */}
          {vista === "solicitudes" && (
            <Seccion
              titulo="Solicitudes de compra"
              accion="Nueva solicitud"
              puedeEditar={puedeEditar}
              abierto={form?.tipo === "solicitud"}
              editando={!!form?.item}
              onAbrir={() => setForm({ tipo: "solicitud", item: null })}
              onCerrar={cerrar}
              form={<FormSolicitud key={form?.item?.id || "nueva"} inicial={form?.item} insumos={insumos} parcelas={parcelasT} onGuardar={(f) => guardarSolicitud(f, form?.item)} />}>
              <div style={{ background: C.papel, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: C.gris }}>
                Flujo: <strong style={{ color: C.azul }}>Solicitado</strong> → <strong style={{ color: C.grano }}>Cotizado</strong> → <strong style={{ color: C.hoja }}>Autorizado</strong> → <strong style={{ color: C.bosque }}>Recibido</strong>. Al recibir, el insumo entra al almacén y se registra la compra automáticamente.
              </div>

              {solicitudesT.length === 0 && <Vacio texto="Sin solicitudes de compra. Levanta la primera con “Nueva solicitud”." />}
              <div className="flex flex-col gap-3">
                {solicitudesT.slice().sort((a, b) => (ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]) || b.fecha.localeCompare(a.fecha)).map(sol => (
                  <SolicitudCard
                    key={sol.id}
                    sol={sol}
                    insumos={insumos}
                    parcelas={parcelasT}
                    creditos={creditosT}
                    productores={productores}
                    veFinanzas={veFinanzas}
                    vePrecios={vePrecios}
                    puedeEditar={puedeEditar}
                    onEditar={() => setForm({ tipo: "solicitud", item: sol })}
                    onEliminar={() => eliminarSolicitud(sol)}
                    onCotizar={(cot) => agregarCotizacion(sol, cot)}
                    onEliminarCot={(cotId) => eliminarCotizacion(sol, cotId)}
                    onAutorizar={(datos) => autorizarSolicitud(sol, datos)}
                    onRecibir={() => recibirSolicitud(sol)}
                  />
                ))}
              </div>
            </Seccion>
          )}

          {/* ===== PRODUCTORES / PRESTANOMBRES ===== */}
          {vista === "productores" && veFinanzas && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>Productores del grupo</h1>
                {puedeEditar && (
                  <div className="flex gap-2 flex-wrap">
                    <Boton secundario onClick={() => setForm({ tipo: "prestamo", item: null })}><Banknote size={15} /> Préstamo en efectivo</Boton>
                    <Boton secundario onClick={() => setForm({ tipo: "dispersion", item: null })}><ArrowRightLeft size={15} /> Registrar dispersión</Boton>
                    <Boton onClick={() => setForm({ tipo: "productor", item: null })}><Plus size={15} /> Nuevo productor</Boton>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 13, color: C.gris, marginTop: -8 }}>
                El estado de cuenta de cada nombre va como lo lleva la financiera: <strong>cargos</strong> = todo lo
                dispersado, prestado en efectivo u ordenado a su código de cliente (rentas, agua, maquilas, compras, gastos);
                <strong> abonos</strong> = sus entregas a bodega. La liquidación de cosecha se cobra contra esto.
              </p>

              <div ref={formRef} style={{ scrollMarginTop: 16 }} />

              {form && form.tipo === "productor" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: "3px solid " + C.hoja }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar productor" : "Nuevo productor"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormProductor key={form.item ? form.item.id : "nuevo"} inicial={form.item} onGuardar={(f) => guardarProductor(f, form.item)} />
                </Tarjeta>
              )}
              {form && form.tipo === "dispersion" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: "3px solid " + C.grano }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar dispersión" : "Registrar dispersión en efectivo"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormDispersion key={form.item ? form.item.id : "nueva"} inicial={form.item} productores={productores} creditos={creditosT} onGuardar={(f) => guardarDispersion(f, form.item)} />
                </Tarjeta>
              )}
              {form && form.tipo === "prestamo" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: "3px solid " + C.barrial }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar préstamo" : "Préstamo en efectivo al productor"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormPrestamo key={form.item ? form.item.id : "nuevo"} inicial={form.item} productores={productores} creditos={creditosT} onGuardar={(f) => guardarPrestamo(f, form.item)} />
                </Tarjeta>
              )}

              <Tarjeta style={{ padding: 16, background: "#FBF4E3", border: "1px solid " + C.grano }}>
                <div className="flex justify-between flex-wrap gap-3" style={{ fontSize: 13, color: C.barrial }}>
                  <span><strong>Consolidado del grupo</strong> · {productores.length} nombres</span>
                  <span>
                    Dispersado: <strong>{money(grupoCargos)}</strong> · Abonado: <strong>{money(grupoAbonos)}</strong> · Saldo por liquidar:{" "}
                    <strong style={{ color: grupoCargos - grupoAbonos > 0 ? C.rojo : C.bosque }}>{money(grupoCargos - grupoAbonos)}</strong>
                  </span>
                </div>
              </Tarjeta>

              {prestamosT.length > 0 && (
                <>
                  <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Préstamos en efectivo · la bolsa de cada productor</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {prestamosT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map(pp => (
                      <PrestamoCard key={pp.id} pp={pp}
                        productor={productores.find(x => x.id === pp.productorId)}
                        linea={pp.creditoId ? creditosT.find(c => c.id === pp.creditoId) : null}
                        parcelas={parcelasT}
                        sinLiquidar={veFinanzas && dispSinLiquidar(pp.origen, pp.fechaPago, pp.disposicionId)}
                        puedeEditar={puedeEditar}
                        onEditar={() => setForm({ tipo: "prestamo", item: pp })}
                        onEliminar={() => eliminarPrestamo(pp)}
                        onLiquidar={() => liquidarPrestamo(pp)}
                        onAplicar={(f) => agregarAplicacion(pp.id, f)}
                        onEliminarAplicacion={(apId) => eliminarAplicacion(pp.id, apId)}
                      />
                    ))}
                  </div>
                </>
              )}

              {productoresQ.isLoading && <Vacio texto="Cargando productores…" />}
              {!productoresQ.isLoading && productores.length === 0 && <Vacio texto="Sin productores registrados." />}
              <div className="grid md:grid-cols-2 gap-3">
                {productores.slice().sort((a, b) => a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre) : a.tipo === "Grupo" ? 1 : -1).map(pr => (
                  <ProductorCard key={pr.id} pr={pr}
                    cuenta={cuentasProductor[pr.id] || { cargos: [], abonos: [], totalCargos: 0, totalAbonos: 0, saldo: 0 }}
                    parcelasPr={parcelasT.filter(p => p.productorId === pr.id)}
                    creditosPr={creditosT.filter(c => c.productorId != null && c.productorId === pr.id)}
                    infoLinea={(cr) => ({ dispuesto: dispuestoLinea(cr), costo: costoFinLineaA(cr, hoyStr) })}
                    puedeEditar={puedeEditar}
                    onEditar={() => setForm({ tipo: "productor", item: pr })}
                    onEliminar={() => eliminarProductor(pr)}
                    onEditarDispersion={(m) => { const disp = dispersionesT.find(d => d.id === m.origenId); if (disp) setForm({ tipo: "dispersion", item: disp }); }}
                    onEliminarDispersion={(m) => eliminarDispersion(m.origenId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ===== GASTOS GENERALES ===== */}
          {vista === "gastos" && veFinanzas && (
            <Seccion titulo="Gastos generales (indirectos)" accion="Registrar gasto" puedeEditar={puedeEditar}
              abierto={form?.tipo === "gasto"} onAbrir={() => setForm({ tipo: "gasto", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormGasto key={form?.item?.id || "nuevo"} inicial={form?.item} parcelas={parcelasT} productores={productores} creditos={creditosT} onGuardar={(f) => guardarGasto(f, form?.item)} />}>
              <p style={{ fontSize: 13, color: C.gris, marginTop: -6 }}>
                Sueldos de planta, gasolina de camionetas, viáticos, seguro agrícola, mantenimiento… Cada gasto puede ir
                <strong> a una parcela</strong> (fue solo para ella), <strong>prorrateado por hectárea</strong> entre todas,
                o quedarse como <strong>general</strong> (solo afecta el estado de resultados, no el costo/ha).
              </p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: "Prorrateado por ha", v: money(gastosProrrateo), s: `${money(gastosIndPorHa)}/ha` },
                  { l: "Asignado a parcelas", v: money(gastosT.filter(g => g.destino === "parcela").reduce((s, g) => s + g.monto, 0)), s: "Directo a su lote" },
                  { l: "General (no prorrateado)", v: money(gastosGenerales), s: "Solo estado de resultados" },
                ].map((k, i) => (
                  <Tarjeta key={i} style={{ padding: 14, borderTop: `3px solid ${C.azul}` }}>
                    <Etiqueta>{k.l}</Etiqueta>
                    <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, marginTop: 4 }}>{k.v}</div>
                    <div style={{ fontSize: 11, color: C.gris }}>{k.s}</div>
                  </Tarjeta>
                ))}
              </div>

              {gastosT.length === 0 && <Vacio texto="Sin gastos generales registrados." />}
              {gastosT.length > 0 && (
                <Tarjeta>
                  {gastosT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((g, i) => {
                    const p = g.parcelaId ? parcelas.find(x => x.id === g.parcelaId) : null;
                    return (
                      <div key={g.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {g.categoria} <span style={{ color: C.gris, fontWeight: 400 }}>· {g.desc}</span>
                            {g.origenCaja && <span style={{ background: "#EEF4EB", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, marginLeft: 6 }}>de caja chica</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {g.fecha} · {g.destino === "parcela" ? `Asignado a ${p?.nombre || "parcela"}` : g.destino === "prorrateo" ? "Prorrateado por hectárea" : "Gasto general"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{money(g.monto)}</div>
                          {puedeEditar && (g.origenCaja
                            ? <span style={{ fontSize: 11, color: C.gris }}>se edita en Caja chica</span>
                            : <Acciones onEditar={() => setForm({ tipo: "gasto", item: g })} onEliminar={() => eliminarGasto(g)} />)}
                        </div>
                      </div>
                    );
                  })}
                </Tarjeta>
              )}
            </Seccion>
          )}

          {/* ===== CAJA CHICA ===== */}
          {vista === "caja" && veFinanzas && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>Caja chica</h1>
                {puedeEditar && !form && (
                  <div className="flex gap-2 flex-wrap">
                    <Boton secundario onClick={() => setForm({ tipo: "cajaFondeo", item: null })}><Plus size={15} /> Fondear caja</Boton>
                    <Boton onClick={() => setForm({ tipo: "cajaSalida", item: null })}><Plus size={15} /> Registrar gasto</Boton>
                  </div>
                )}
              </div>

              <p style={{ fontSize: 13, color: C.gris, margin: 0 }}>
                El efectivo de la caja baja con cada salida. Las salidas <strong>se reconocen como gasto cuando oficina las autoriza</strong> —
                ahí entran al costo y al estado de resultados. Las pendientes ya bajaron el efectivo pero están en revisión.
              </p>

              {form?.tipo === "cajaFondeo" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: `3px solid ${C.hoja}` }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar fondeo" : "Fondear caja"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormCajaFondeo key={form.item?.id || "nuevo"} inicial={form.item} creditos={creditosT} onGuardar={(f) => guardarCajaFondeo(f, form.item)} />
                </Tarjeta>
              )}
              {form?.tipo === "cajaSalida" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: `3px solid ${C.hoja}` }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar gasto de caja" : "Registrar gasto de caja"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormCajaSalida key={form.item?.id || "nuevo"} inicial={form.item} parcelas={parcelasT} onGuardar={(f) => guardarCajaSalida(f, form.item)} />
                </Tarjeta>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { l: "Fondeado", v: money(cajaFondeado), s: "Efectivo que ha entrado", alerta: false },
                  { l: "Gastado", v: money(cajaGastado), s: "Salidas totales", alerta: false },
                  { l: "Saldo en caja", v: money(cajaSaldo), s: cajaSaldo < 0 ? "¡Sobregirada!" : "Efectivo disponible", alerta: cajaSaldo < 1000 },
                  { l: "Por autorizar", v: money(cajaPorAutorizar), s: cajaPorAutorizar > 0 ? "Salidas en revisión" : "Al corriente", alerta: cajaPorAutorizar > 0 },
                ].map((k, i) => (
                  <Tarjeta key={i} style={{ padding: 16, borderTop: k.alerta ? `3px solid ${C.grano}` : `3px solid ${C.bosque}` }}>
                    <Etiqueta>{k.l}</Etiqueta>
                    <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, marginTop: 4, color: k.l === "Saldo en caja" && cajaSaldo < 0 ? C.rojo : C.tinta }}>{k.v}</div>
                    <div style={{ fontSize: 12, color: k.alerta ? C.barrial : C.gris, fontWeight: k.alerta ? 700 : 400 }}>{k.s}</div>
                  </Tarjeta>
                ))}
              </div>

              {cajaMovsT.filter(m => m.tipo === "salida" && m.estado === "pendiente").length > 0 && (
                <Tarjeta style={{ padding: 18, borderTop: `3px solid ${C.grano}` }}>
                  <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Salidas por autorizar · {money(cajaPorAutorizar)}</div>
                  <div className="flex flex-col mt-2">
                    {cajaMovsT.filter(m => m.tipo === "salida" && m.estado === "pendiente").slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((m, i) => {
                      const p = m.parcelaId ? parcelas.find(x => x.id === m.parcelaId) : null;
                      return (
                        <div key={m.id} className="flex justify-between items-center gap-3 py-2.5 flex-wrap" style={{ borderTop: i ? `1px dashed ${C.linea}` : "none" }}>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap" style={{ fontWeight: 600, fontSize: 14 }}>
                              {m.concepto}
                              {!m.comprobante && <span style={{ background: "#FBEEE9", color: C.rojo, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>sin comprobante</span>}
                            </div>
                            <div style={{ fontSize: 12, color: C.gris }}>
                              {m.fecha} · gastó {m.quien || "—"} · {m.destino === "parcela" ? `a ${p?.nombre || "parcela"}` : m.destino === "prorrateo" ? "prorrateado por ha" : "general"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 16 }}>{money(m.monto)}</div>
                            {puedeEditar && <Boton chico onClick={() => autorizarCajaSalida(m)}><CheckCircle2 size={13} /> Autorizar</Boton>}
                            {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "cajaSalida", item: m })} onEliminar={() => eliminarCajaMov(m)} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Tarjeta>
              )}

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 4 }}>Movimientos de la caja</div>
              {cajaMovsT.length === 0 && <Vacio texto="Sin movimientos de caja. Empieza por fondear la caja." />}
              {cajaMovsT.length > 0 && (
                <Tarjeta>
                  {cajaMovsT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((m, i) => {
                    const p = m.parcelaId ? parcelas.find(x => x.id === m.parcelaId) : null;
                    const esFondeo = m.tipo === "fondeo";
                    return (
                      <div key={m.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap" style={{ fontWeight: 600, fontSize: 14 }}>
                            {esFondeo
                              ? <><Coins size={14} color={C.bosque} /> Fondeo {m.nota ? <span style={{ color: C.gris, fontWeight: 400 }}>· {m.nota}</span> : null}</>
                              : <>{m.concepto}</>}
                            {!esFondeo && (m.estado === "autorizada"
                              ? <span style={{ background: "#E8F1E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Autorizada {m.fechaAutorizacion || ""}</span>
                              : <span style={{ background: "#FBF4E3", color: C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Por autorizar</span>)}
                          </div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {esFondeo
                              ? `${m.fecha} · ${m.origen === "linea" ? `sobre línea: ${creditosT.find(c => c.id === m.creditoId)?.fuente || "—"}` : "recurso propio"}`
                              : `${m.fecha} · gastó ${m.quien || "—"} · ${m.destino === "parcela" ? `a ${p?.nombre || "parcela"}` : m.destino === "prorrateo" ? "prorrateado por ha" : "general"}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontWeight: 700, fontSize: 14, color: esFondeo ? C.bosque : C.tinta }}>{esFondeo ? "+" : "−"}{money(m.monto)}</div>
                          {puedeEditar && m.estado !== "autorizada" && <Acciones onEditar={() => setForm({ tipo: esFondeo ? "cajaFondeo" : "cajaSalida", item: m })} onEliminar={() => eliminarCajaMov(m)} />}
                          {puedeEditar && m.estado === "autorizada" && <Acciones onEliminar={() => eliminarCajaMov(m)} />}
                        </div>
                      </div>
                    );
                  })}
                </Tarjeta>
              )}
            </div>
          )}

          {/* ===== FINANCIAMIENTO ===== */}
          {vista === "credito" && veFinanzas && (
            <Seccion titulo="Financiamiento" accion="Nueva línea de crédito" puedeEditar={puedeEditar}
              abierto={form?.tipo === "credito"} onAbrir={() => setForm({ tipo: "credito", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormCredito key={form?.item?.id || "nuevo"} inicial={form?.item} productores={productores} onGuardar={(f) => guardarCredito(f, form?.item)} />}>
              <Tarjeta style={{ padding: 16, background: "#FBF4E3", border: `1px solid ${C.grano}` }}>
                <div style={{ fontSize: 13, color: C.barrial }}>
                  <strong>Costo financiero total: {money(costoFinTotal)}</strong> · Deuda viva: <strong>{money(deudaViva)}</strong>.
                  El interés de cada línea corre por día sobre <strong>cada disposición desde su fecha</strong> (avío revolvente), no sobre el monto autorizado.
                  La prima FEGA y la comisión por apertura son cobros únicos sobre el monto autorizado.
                </div>
              </Tarjeta>

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Líneas de crédito</div>
              {creditosT.length === 0 && <Vacio texto="Sin créditos registrados en esta temporada." />}
              <div className="grid md:grid-cols-2 gap-3">
                {creditosT.map(cr => {
                  const dVenc = cr.fechaVencimiento ? diasHasta(cr.fechaVencimiento) : null;
                  const disps = dispsDeLinea(cr.id);
                  const dispuesto = disps.reduce((s, d) => s + d.monto, 0);
                  const intLinea = interesLineaA(cr, hoyStr);
                  const porTipo = disps.reduce((m, d) => { m[d.tipo] = (m[d.tipo] || 0) + d.monto; return m; }, {});
                  return (
                    <Tarjeta key={cr.id} style={{ padding: 18, borderTop: `3px solid ${C.grano}` }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>{cr.fuente}</span>
                            <span style={{ background: cr.tipoCredito === "Directo" ? "#E8F1E6" : "#EEE9F5", color: cr.tipoCredito === "Directo" ? C.bosque : "#5B4A7A", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{cr.tipoCredito}</span>
                          </div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {cr.destino} · {cr.fechaInicio} → {cr.fechaVencimiento} ({plazoDias(cr)} días de plazo)
                          </div>
                          {dVenc !== null && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: dVenc < 0 ? C.rojo : dVenc <= 60 ? C.barrial : C.hoja, marginTop: 2 }}>
                              {dVenc < 0 ? `⚠ Vencido hace ${Math.abs(dVenc)} días` : `Vence en ${dVenc} días`}
                            </div>
                          )}
                        </div>
                        {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "credito", item: cr })} onEliminar={() => eliminarCredito(cr)} />}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3" style={{ fontSize: 13 }}>
                        <Fila l="Monto autorizado / línea" v={money(cr.monto)} />
                        <Fila l="Dispuesto a la fecha" v={money(dispuesto)} />
                        <Fila l="Tasa (TIIE + spread)" v={`${num(cr.tiie, 2)} + ${num(cr.spread, 2)} = ${num(tasaCredito(cr), 2)}%`} />
                        <Fila l="Interés devengado (por disposición)" v={money(intLinea)} resalta />
                        <Fila l={`Prima FEGA (${num(cr.fega, 2)}% × plazo)`} v={money(fegaCredito(cr))} resalta />
                        <Fila l={`Comisión apertura (${num(cr.comision, 2)}%)`} v={money(comisionCredito(cr))} resalta />
                        <Fila l="Costo financiero total" v={money(intLinea + fegaCredito(cr) + comisionCredito(cr))} />
                      </div>
                      {dispuesto > 0 && (
                        <div className="mt-2" style={{ background: C.papel, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>Disposiciones ({disps.length}): {money(dispuesto)}</span>
                          <span style={{ color: C.gris }}>
                            {Object.keys(porTipo).map(t => ` · ${t.toLowerCase()} ${money(porTipo[t])}`).join("")}
                          </span>
                        </div>
                      )}
                    </Tarjeta>
                  );
                })}
              </div>

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Compras a crédito de proveedor</div>
              {comprasT.filter(c => c.origen === "externo").length === 0 && <Vacio texto="Sin compras a crédito de proveedor." />}
              {comprasT.filter(c => c.origen === "externo").length > 0 && (
                <Tarjeta>
                  {comprasT.filter(c => c.origen === "externo").map((cp, i) => (
                    <div key={cp.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{cp.insumoNombre} · {cp.proveedor}</div>
                        <div style={{ fontSize: 12, color: C.gris }}>
                          {money(cp.monto)} al {num(cp.tasa, 1)}% desde {cp.fecha}
                          {cp.fechaPago ? ` · pagada el ${cp.fechaPago}` : ` · ${diasEntre(cp.fecha, hoyStr)} días corriendo`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 700, fontSize: 14, color: cp.fechaPago ? C.gris : C.barrial }}>+{money(interesCompra(cp))}</div>
                        {puedeEditar && !cp.fechaPago && <Boton chico secundario onClick={() => marcarPagada(cp)}><CheckCircle2 size={13} /> Marcar pagada</Boton>}
                      </div>
                    </div>
                  ))}
                </Tarjeta>
              )}

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Rentas financiadas aparte</div>
              {parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").length === 0 && <Vacio texto="Sin rentas financiadas aparte." />}
              {parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").length > 0 && (
                <Tarjeta>
                  {parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").map((p, i) => (
                    <div key={p.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Renta · {p.nombre} ({p.cultivo})</div>
                        <div style={{ fontSize: 12, color: C.gris }}>
                          {money(rentaMonto(p))} al {num(p.tasaRenta, 1)}% desde {p.fechaRenta}
                          {p.fechaPagoRenta ? ` · pagada el ${p.fechaPagoRenta}` : ` · ${diasEntre(p.fechaRenta, hoyStr)} días corriendo`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 700, fontSize: 14, color: p.fechaPagoRenta ? C.gris : C.barrial }}>+{money(rentaInteres(p))}</div>
                        {puedeEditar && !p.fechaPagoRenta && <Boton chico secundario onClick={() => pagarRenta(p)}><CheckCircle2 size={13} /> Renta pagada</Boton>}
                      </div>
                    </div>
                  ))}
                </Tarjeta>
              )}
            </Seccion>
          )}

          {/* ===== COSTO FINANCIERO (desglose por disposición + simulador de fecha) ===== */}
          {vista === "costofin" && veFinanzas && (
            <div className="flex flex-col gap-4">
              <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>Costo financiero</h1>
              {(() => {
                const corteObj = fechaObjetivo || hoyStr;
                const corteFila = (d) => d.fechaPago || pagoSupuesto[d.clave] || corteObj;
                const lineas = creditosT.map(cr => {
                  const ds = dispsDeLinea(cr.id).map(d => {
                    // Saldada → corte congelado en ult_pago. No saldada → "a hoy" y "al corte"
                    // (corte = fecha de abono supuesta del renglón, capada a hoy, o la global).
                    const corteHoy = d.saldada ? d.fechaCorte : hoyStr;
                    const corteObjFila = d.saldada ? d.fechaCorte : (pagoSupuesto[d.clave] || corteObj);
                    return {
                      ...d, tasa: tasaCredito(cr),
                      intHoy: interesInsoluto(d.monto, d.fecha, tasaCredito(cr), corteHoy, d.pagos),
                      intObj: interesInsoluto(d.monto, d.fecha, tasaCredito(cr), corteObjFila, d.pagos),
                      diasHoy: Math.max(0, diasEntre(d.fecha, corteHoy)),
                      diasObj: Math.max(0, diasEntre(d.fecha, corteObjFila)),
                    };
                  });
                  return { cr, ds, fega: fegaCredito(cr), com: comisionCredito(cr),
                    intHoy: ds.reduce((s, d) => s + d.intHoy, 0), intObj: ds.reduce((s, d) => s + d.intObj, 0) };
                }).filter(L => L.ds.length > 0 || L.fega > 0 || L.com > 0);

                const externos = [
                  ...comprasT.filter(c => c.origen === "externo").map(c => ({ clave: "compra-ext-" + c.id, grupo: "Compra a proveedor", ref: c.insumoNombre || c.proveedor || "Insumo", fecha: c.fecha, fechaPago: c.fechaPago, monto: c.monto, tasa: Number(c.tasa) || 0 })),
                  ...gastosT.filter(g => g.origen === "externo").map(g => ({ clave: "gasto-ext-" + g.id, grupo: "Gasto financiado", ref: g.desc || g.categoria || "Gasto", fecha: g.fecha, fechaPago: g.fechaPago, monto: g.monto, tasa: Number(g.tasa) || 0 })),
                  ...parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").map(p => ({ clave: "renta-ext-" + p.id, grupo: "Renta financiada", ref: p.nombre, fecha: p.fechaRenta, fechaPago: p.fechaPagoRenta, monto: rentaMonto(p), tasa: Number(p.tasaRenta) || 0 })),
                ].map(e => {
                  const corte = corteFila(e);
                  return {
                    ...e,
                    intHoy: interesDisp(e.monto, e.fecha || hoyStr, e.tasa, e.fechaPago || hoyStr),
                    intObj: interesDisp(e.monto, e.fecha || hoyStr, e.tasa, corte),
                    diasHoy: Math.max(0, diasEntre(e.fecha || hoyStr, e.fechaPago || hoyStr)),
                    diasObj: Math.max(0, diasEntre(e.fecha || hoyStr, corte)),
                  };
                }).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));

                const intLineasHoy = lineas.reduce((s, L) => s + L.intHoy, 0);
                const intLineasObj = lineas.reduce((s, L) => s + L.intObj, 0);
                const accTot = lineas.reduce((s, L) => s + L.fega + L.com, 0);
                const intExtHoy = externos.reduce((s, e) => s + e.intHoy, 0);
                const intExtObj = externos.reduce((s, e) => s + e.intObj, 0);
                const intHoyTot = intLineasHoy + intExtHoy;
                const intObjTot = intLineasObj + intExtObj;
                const cfHoy = intHoyTot + accTot;
                const cfObj = intObjTot + accTot;
                const objEsFuturo = corteObj > hoyStr;

                const th = { textAlign: "left", padding: "6px 8px", fontSize: 11, color: C.gris, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: `1px solid ${C.linea}` };
                const thR = { ...th, textAlign: "right" };
                const td = { padding: "6px 8px", fontSize: 12.5, borderBottom: `1px solid ${C.papel}` };
                const tdR = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
                /* PAGOS PARCIALES — celda de pago en Costo financiero (único lugar para liquidar).
                   LÍNEA (d.disposicionId): lista de abonos (cada uno con "revertir" → p_pago_id),
                   saldo restante, y si hay saldo: input fecha (≤ hoy) + input monto + "Abonar"
                   (parcial → p_monto) + "Liquidar resto" (p_monto=null). Saldada → "✓ Saldada".
                   EXTERNO (sin disposición): what-if de fecha simple (capado a hoy), sin botones.
                   Todo gateado por puedeEditar (Consulta no edita; Encargado de campo ni ve finanzas). */
                const inputFechaPago = (d, ancho) => (
                  <input type="date" max={hoyStr} value={pagoSupuesto[d.clave] || ""}
                    onChange={(e) => setPagoSupuesto(prev => { const n = { ...prev }; if (e.target.value) n[d.clave] = e.target.value; else delete n[d.clave]; return n; })}
                    style={{ border: `1px solid ${pagoSupuesto[d.clave] ? C.hoja : C.linea}`, borderRadius: 6, padding: "3px 4px", fontSize: 11, fontFamily: fuente.cuerpo, color: C.tinta, background: pagoSupuesto[d.clave] ? "#EEF4EB" : C.blanco, width: ancho }} />
                );
                const celdaPago = (d) => {
                  // EXTERNO: sin disposición → what-if simple, sin botones.
                  if (!d.disposicionId) {
                    return d.fechaPago
                      ? <span style={{ fontSize: 11, color: C.hoja }}>{d.fechaPago} <span style={{ color: C.gris }}>(real)</span></span>
                      : inputFechaPago(d, 130);
                  }
                  // LÍNEA: abonos parciales.
                  const pagos = d.pagos || [];
                  const saldo = d.saldo != null ? d.saldo : d.monto;
                  const fechaAbono = pagoSupuesto[d.clave] || hoyStr;
                  const m = Number(abonoMonto[d.clave]);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 210 }}>
                      {pagos.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {pagos.map(p => (
                            <div key={p.id} className="flex items-center gap-2" style={{ fontSize: 11 }}>
                              <span style={{ color: C.hoja }}>{p.fecha}</span>
                              <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(p.monto)}</span>
                              {puedeEditar &&
                                <button onClick={() => revertirLiquidacion(d.disposicionId, p.id)}
                                  style={{ fontSize: 10, color: C.rojo, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>revertir</button>}
                            </div>
                          ))}
                        </div>
                      )}
                      {d.saldada
                        ? <span style={{ fontSize: 11, fontWeight: 600, color: C.hoja }}>✓ Saldada{d.fechaCorte ? ` el ${d.fechaCorte}` : ""}</span>
                        : <>
                            <span style={{ fontSize: 11, color: C.gris }}>Saldo: <strong style={{ color: C.tinta }}>{money(saldo)}</strong></span>
                            {puedeEditar && (
                              <div className="flex items-center gap-1" style={{ flexWrap: "wrap" }}>
                                {inputFechaPago(d, 116)}
                                <input type="number" inputMode="decimal" placeholder="monto" value={abonoMonto[d.clave] || ""}
                                  onChange={(e) => setAbonoMonto(prev => { const n = { ...prev }; if (e.target.value) n[d.clave] = e.target.value; else delete n[d.clave]; return n; })}
                                  style={{ border: `1px solid ${C.linea}`, borderRadius: 6, padding: "3px 4px", fontSize: 11, fontFamily: fuente.cuerpo, color: C.tinta, width: 76 }} />
                                <Boton chico secundario deshabilitado={!m || m <= 0}
                                  onClick={() => {
                                    if (!m || m <= 0) return;
                                    liquidarDisposicion(d.disposicionId, fechaAbono, m);
                                    setAbonoMonto(prev => { const n = { ...prev }; delete n[d.clave]; return n; });
                                  }}>Abonar</Boton>
                                <Boton chico onClick={() => liquidarDisposicion(d.disposicionId, fechaAbono, null)}>
                                  <CheckCircle2 size={13} /> Liquidar resto
                                </Boton>
                              </div>
                            )}
                          </>}
                    </div>
                  );
                };

                return (
                  <>
                    <Tarjeta style={{ padding: 16, background: "#EEF4EB", border: `1px solid ${C.hoja}` }}>
                      <div className="flex flex-wrap items-end gap-4 justify-between">
                        <div style={{ fontSize: 13, color: C.barrial, maxWidth: 560 }}>
                          Aquí está <strong>todo lo que traes a crédito</strong>: cada disposición devenga interés desde su fecha.
                          Pon una <strong>fecha de pago supuesta</strong> y verás cuánto te costaría si liquidaras todo ese día.
                          También puedes fijar una fecha distinta <strong>por renglón</strong> (en la columna "Pago supuesto"); las que dejes en blanco usan la global. Las que ya tienen fecha de pago real se respetan.
                        </div>
                        <div>
                          <div className="flex items-center gap-2" style={{ fontSize: 12, color: C.gris, marginBottom: 4 }}>
                            <CalendarClock size={15} /> Si liquido todo el…
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="date" style={{ ...estiloInput, width: "auto" }} value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
                            <Boton chico secundario onClick={() => setFechaObjetivo(hoyStr)}>Hoy</Boton>
                          </div>
                        </div>
                      </div>
                    </Tarjeta>

                    <div className="grid md:grid-cols-3 gap-3">
                      {[
                        { l: "Interés a hoy", v: intHoyTot, s: hoyStr, color: C.barrial },
                        { l: `Interés al ${corteObj}`, v: intObjTot, s: objEsFuturo ? "fecha global + ajustes por renglón" : "= hoy", color: C.bosque },
                        { l: "Accesorios (FEGA + comisión)", v: accTot, s: "fijos, no cambian con la fecha", color: C.grano },
                      ].map(k => (
                        <Tarjeta key={k.l} style={{ padding: 14 }}>
                          <Etiqueta>{k.l}</Etiqueta>
                          <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 19, color: k.color }}>{money(k.v)}</div>
                          <div style={{ fontSize: 11, color: C.gris }}>{k.s}</div>
                        </Tarjeta>
                      ))}
                    </div>

                    <Tarjeta style={{ padding: 16, background: "#FBF4E3", border: `1px solid ${C.grano}` }}>
                      <div className="flex flex-wrap gap-x-6 gap-y-1" style={{ fontSize: 13, color: C.barrial }}>
                        <span><strong>Costo financiero a hoy:</strong> {money(cfHoy)}</span>
                        <span><strong>Costo financiero al {corteObj}:</strong> {money(cfObj)}</span>
                        {objEsFuturo && <span style={{ color: C.rojo }}><strong>Esperar hasta esa fecha cuesta:</strong> {money(cfObj - cfHoy)} más de interés</span>}
                      </div>
                    </Tarjeta>

                    {lineas.length === 0 && externos.length === 0 && <Vacio texto="No hay disposiciones a crédito registradas en esta temporada." />}

                    {lineas.map(L => (
                      <Tarjeta key={L.cr.id} style={{ padding: 0, overflow: "hidden", borderTop: `3px solid ${C.grano}` }}>
                        <div className="flex justify-between items-center flex-wrap gap-2" style={{ padding: "12px 14px", background: C.papel }}>
                          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>{L.cr.fuente}</div>
                          <div style={{ fontSize: 12, color: C.gris }}>Tasa {num(tasaCredito(L.cr), 2)}% anual · {L.ds.length} disposición(es)</div>
                        </div>
                        {L.ds.length > 0 && (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                              <thead><tr>
                                <th style={th}>Concepto</th><th style={th}>Fecha</th><th style={thR}>Monto</th>
                                <th style={thR}>Días a hoy</th><th style={thR}>Interés hoy</th>
                                <th style={th}>Pago supuesto</th>
                                <th style={thR}>Días al corte</th><th style={thR}>Interés al corte</th>
                              </tr></thead>
                              <tbody>
                                {L.ds.map((d, i) => (
                                  <tr key={i}>
                                    <td style={td}><span style={{ fontWeight: 600 }}>{d.tipo}</span> <span style={{ color: C.gris }}>· {d.ref}</span></td>
                                    <td style={td}>{d.fecha}</td>
                                    <td style={tdR}>{money(d.monto)}</td>
                                    <td style={tdR}>{d.diasHoy}</td>
                                    <td style={tdR}>{money(d.intHoy)}</td>
                                    <td style={td}>{celdaPago(d)}</td>
                                    <td style={tdR}>{d.diasObj}</td>
                                    <td style={{ ...tdR, fontWeight: 600 }}>{money(d.intObj)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div style={{ padding: "10px 14px", fontSize: 12.5, display: "flex", flexWrap: "wrap", gap: "4px 18px", justifyContent: "flex-end", borderTop: `1px solid ${C.linea}` }}>
                          <span style={{ color: C.gris }}>Interés línea: <strong style={{ color: C.tinta }}>{money(L.intHoy)}</strong> (hoy) · <strong style={{ color: C.bosque }}>{money(L.intObj)}</strong> (al corte)</span>
                          {(L.fega > 0 || L.com > 0) && <span style={{ color: C.gris }}>+ accesorios {money(L.fega + L.com)}</span>}
                          <span>Total línea al corte: <strong>{money(L.intObj + L.fega + L.com)}</strong></span>
                        </div>
                      </Tarjeta>
                    ))}

                    {externos.length > 0 && (
                      <Tarjeta style={{ padding: 0, overflow: "hidden", borderTop: `3px solid ${C.azul}` }}>
                        <div style={{ padding: "12px 14px", background: C.papel, fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>
                          Crédito de proveedor / financiamiento externo
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead><tr>
                              <th style={th}>Concepto</th><th style={th}>Fecha</th><th style={thR}>Monto</th><th style={thR}>Tasa</th>
                              <th style={thR}>Días a hoy</th><th style={thR}>Interés hoy</th>
                              <th style={th}>Pago supuesto</th>
                              <th style={thR}>Días al corte</th><th style={thR}>Interés al corte</th>
                            </tr></thead>
                            <tbody>
                              {externos.map((e, i) => (
                                <tr key={i}>
                                  <td style={td}><span style={{ fontWeight: 600 }}>{e.grupo}</span> <span style={{ color: C.gris }}>· {e.ref}</span></td>
                                  <td style={td}>{e.fecha}</td>
                                  <td style={tdR}>{money(e.monto)}</td>
                                  <td style={tdR}>{num(e.tasa, 1)}%</td>
                                  <td style={tdR}>{e.diasHoy}</td>
                                  <td style={tdR}>{money(e.intHoy)}</td>
                                  <td style={td}>{celdaPago(e)}</td>
                                  <td style={tdR}>{e.diasObj}</td>
                                  <td style={{ ...tdR, fontWeight: 600 }}>{money(e.intObj)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ padding: "10px 14px", fontSize: 12.5, textAlign: "right", borderTop: `1px solid ${C.linea}` }}>
                          Interés externo: <strong>{money(intExtHoy)}</strong> (hoy) · <strong style={{ color: C.bosque }}>{money(intExtObj)}</strong> (al corte)
                        </div>
                      </Tarjeta>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* ===== REPORTES + SIMULADOR ===== */}
          {vista === "reportes" && veFinanzas && (
            <div className="flex flex-col gap-4">
              <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>Reportes y simulador</h1>

              <Simulador parcelasT={parcelasT} costosParcela={costosParcela} inversionTotal={inversionTotal} ingresoTotal={ingresoTotal} />

              <Reportes parcelasT={parcelasT} laboresT={laboresHechas} nominaT={nominaT} insumos={insumos} gastosT={gastosT}
                apsProductivas={apsProductivas} prestamosT={prestamosT} productores={productores}
                costoFinTotal={costoFinTotal} inversionTotal={inversionTotal} costoDirectoTotal={costoDirectoTotal}
                gastosIndTotal={gastosIndTotal} ingresoTotal={ingresoTotal} ingresoRealTotal={ingresoRealTotal}
                rentaTotal={rentaTotal} haTotal={haTotal} dieselUsado={dieselUsado} dieselCosto={dieselCosto} costosParcela={costosParcela} />
            </div>
          )}

          {vista === "ajustes" && rol === "Dueño" && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 26, margin: 0 }}>Ajustes del predio</h1>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: C.gris }}>
                  Equipo, permisos, ciclos y catálogo. Lo que vive el lote se captura en las otras secciones.
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-11 text-sm font-semibold"
                  style={{ background: "none", border: "none", color: C.hoja, padding: 0 }}
                  onClick={() => setGuia(true)}
                >
                  Ver guía de uso
                </button>
              </div>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Predio</div>
                <p style={{ margin: "8px 0 12px", fontSize: 12, color: C.gris }}>
                  Tú eres Dueño · {user?.primaryEmail || user?.displayName || "cuenta"}
                </p>
                <Campo label="Nombre del predio">
                  <input
                    defaultValue={profile.orgNombre}
                    style={estiloInput}
                    onBlur={(e) => {
                      const nombre = e.target.value.trim();
                      if (nombre && nombre !== profile.orgNombre) void guardarAjustes({ nombre });
                    }}
                  />
                </Campo>
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Código para tu equipo</div>
                <p style={{ margin: "8px 0 12px", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                  El Encargado y la oficina lo escriben al entrar. Sin código abren su propio predio, no el tuyo.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="rounded-[10px] px-3 py-2 font-mono text-lg font-semibold tracking-[0.2em]"
                    style={{ background: "#EEF4EB", border: `1px solid ${C.linea}`, minHeight: 44, display: "flex", alignItems: "center" }}
                  >
                    {profile.codigoInvitacion || "————"}
                  </div>
                  <Boton
                    secundario
                    onClick={() => {
                      const c = profile.codigoInvitacion;
                      if (c && navigator.clipboard) void navigator.clipboard.writeText(c);
                    }}
                  >
                    <Copy size={14} /> Copiar
                  </Boton>
                  <Boton
                    secundario
                    onClick={() => {
                      if (window.confirm("El código anterior deja de servir. ¿Nuevo código?")) void regenerarCodigo();
                    }}
                  >
                    Nuevo código
                  </Boton>
                </div>
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Ciclos de siembra</div>
                <p style={{ margin: "6px 0 12px", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                  El ciclo que ves arriba a la derecha es el que se está trabajando. Edita fechas y nombre, o elimínalo si no tiene movimientos.
                </p>
                <CiclosAdmin
                  ciclos={ciclos}
                  actualId={CICLO_ID}
                  onUsar={async (id) => { await setCiclo(id); setVista("panel"); }}
                  onCambio={async (id) => { await reload(); if (id) await setCiclo(id); }}
                  onEliminado={async (id) => {
                    const otro = ciclos.find((c) => c.id !== id);
                    await reload();
                    if (otro) await setCiclo(otro.id);
                  }}
                />
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Roles</div>
                <RolesPanel />
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Equipo y permisos</div>
                <EquipoPanel variante="pagina" />
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Campo</div>
                <label className="mt-3 flex items-start gap-3" style={{ fontSize: 14, cursor: "pointer", minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={profile.encargadoVePrecios}
                    onChange={(e) => void guardarAjustes({ encargadoVePrecios: e.target.checked })}
                    style={{ marginTop: 3, accentColor: C.bosque, width: 18, height: 18 }}
                  />
                  <span>
                    Todos los Encargados ven precios de cotizaciones
                    <span style={{ display: "block", fontSize: 12, color: C.gris, marginTop: 2 }}>
                      Además puedes palomear “Ve montos y finanzas” por persona en Equipo.
                    </span>
                  </span>
                </label>
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Catálogo de insumos</div>
                <p style={{ margin: "6px 0 12px", fontSize: 13, color: C.gris }}>
                  Nombres y unidades del predio. El stock nace cuando registras una compra. Aquí no hay existencias inventadas.
                </p>
                <CatalogoInsumos insumos={insumos} onGuardar={guardarInsumo} onEliminar={eliminarInsumo} />
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Datos de prueba</div>
                <p style={{ margin: "8px 0 12px", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                  Este predio debe quedar en ceros para la siembra que empieza. La demo OI 2025/26 (2,150 L, FIRA, productor 3567) no es información real.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Boton
                    onClick={() => {
                      if (window.confirm("Vaciar el predio: queda OI 2026/27 sin parcelas, sin almacén y sin crédito. Se pierde lo capturado.")) {
                        void vaciar().then(() => window.location.reload());
                      }
                    }}
                  >
                    Dejar predio en ceros
                  </Boton>
                  <Boton
                    secundario
                    onClick={() => {
                      if (window.confirm("Esto carga números de PRUEBA (OI 2025/26). No son del predio. ¿Seguro?")) {
                        void restaurarDemo().then(() => window.location.reload());
                      }
                    }}
                  >
                    Cargar demo de prueba
                  </Boton>
                </div>
              </Tarjeta>
            </div>
          )}
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

function CanarioBadge() {
  const [open, setOpen] = useState(false);
  const result = runCanarios();
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={result.allOk ? "Canarios de paridad: OK" : "Canarios de paridad: revisar"}
        style={{
          ...estiloInput, width: "auto", cursor: "pointer", fontWeight: 700, fontSize: 11,
          background: result.allOk ? "rgba(232,241,230,0.95)" : "rgba(251,238,233,0.95)",
          color: result.allOk ? C.bosque : C.rojo,
          border: `1px solid ${result.allOk ? "rgba(255,255,255,0.35)" : C.rojo}`,
        }}
      >
        {result.allOk ? "Canarios OK" : "Canarios · revisar"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 50, width: 360, maxWidth: "80vw",
            background: C.blanco, color: C.tinta, border: `1px solid ${C.linea}`, borderRadius: 12,
            boxShadow: "0 12px 32px rgba(28,36,25,0.18)", padding: 12, fontFamily: fuente.cuerpo,
          }}
        >
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            Verificación de paridad (corte { "2026-06-15" })
          </div>
          {result.checks.map((c) => (
            <div key={c.id} style={{ fontSize: 12, padding: "6px 0", borderTop: `1px solid ${C.linea}` }}>
              <div style={{ fontWeight: 600 }}>{c.ok ? "✓" : "✕"} {c.label}</div>
              <div style={{ color: C.gris, marginTop: 2 }}>esperado {c.expected} · hoy {c.got}</div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: C.gris, margin: "8px 0 0" }}>
            Si liquidas disposiciones o editas el ledger, el canario oficial deja de dar 97,977.53 — es correcto. Restaura la demo para volver al corte verificado.
          </p>
        </div>
      )}
    </div>
  );
}

function FormCiclo({ inicial, onListo, etiquetaSubmit }) {
  const [clave, setClave] = useState(inicial?.clave || "");
  const [nombre, setNombre] = useState(inicial?.nombre || "");
  const [inicio, setInicio] = useState(inicial?.fechaInicio || inicial?.fecha_inicio || "");
  const [fin, setFin] = useState(inicial?.fechaFin || inicial?.fecha_fin || "");
  const [presupuesto, setPresupuesto] = useState(
    inicial?.presupuesto != null && Number(inicial.presupuesto) > 0 ? String(inicial.presupuesto) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return (
    <div className="flex flex-col gap-2">
      <Campo label="Clave">
        <input style={estiloInput} placeholder="ej. oi2627" value={clave} onChange={(e) => setClave(e.target.value)} />
      </Campo>
      <Campo label="Nombre">
        <input style={estiloInput} placeholder="ej. Otoño–Invierno 2026/27" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo label="Inicio"><input type="date" style={estiloInput} value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
      <Campo label="Fin"><input type="date" style={estiloInput} value={fin} onChange={(e) => setFin(e.target.value)} /></Campo>
      <Campo label="Presupuesto del ciclo (pesos)">
        <input
          type="number"
          min="0"
          step="1000"
          style={estiloInput}
          placeholder="0 = sin presupuesto"
          value={presupuesto}
          onChange={(e) => setPresupuesto(e.target.value)}
        />
      </Campo>
      {error && <p style={{ fontSize: 12, color: C.rojo, fontWeight: 600, margin: 0 }}>{error}</p>}
      <Boton
        deshabilitado={busy || !clave.trim() || !nombre.trim()}
        onClick={() => {
          setBusy(true);
          setError(null);
          void onListo({
            clave: clave.trim(),
            nombre: nombre.trim(),
            inicio,
            fin,
            presupuesto: presupuesto === "" ? 0 : Math.max(0, Number(presupuesto) || 0),
          })
            .catch((e) => {
              setError(e instanceof Error ? e.message : String(e));
              setBusy(false);
            });
        }}
      >
        {busy ? "Guardando…" : (etiquetaSubmit || "Guardar")}
      </Boton>
    </div>
  );
}

function CiclosAdmin({ ciclos, actualId, onUsar, onCambio, onEliminado }) {
  const [editId, setEditId] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {ciclos.map((c) => (
        <div
          key={c.id}
          style={{
            padding: 12, borderRadius: 10, border: `1px solid ${c.id === actualId ? C.bosque : C.linea}`,
            background: c.id === actualId ? "#EEF4EB" : C.blanco,
          }}
        >
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nombre}</div>
              <div style={{ fontSize: 12, color: C.gris }}>
                {String(c.clave || "").toUpperCase()}
                {c.fechaInicio ? ` · ${c.fechaInicio}` : ""}{c.fechaFin ? ` → ${c.fechaFin}` : ""}
                {Number(c.presupuesto) > 0 ? ` · presupuesto ${money(c.presupuesto)}` : ""}
                {c.id === actualId ? " · trabajando" : ""}
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {c.id !== actualId && (
                <Boton chico secundario onClick={() => void onUsar(c.id)}>Usar</Boton>
              )}
              <Boton chico secundario onClick={() => { setNuevo(false); setEditId(editId === c.id ? null : c.id); }}>Editar</Boton>
              <Boton chico secundario onClick={() => {
                if (ciclos.length <= 1) {
                  window.alert("Abre otro ciclo antes de eliminar este.");
                  return;
                }
                const forzar = window.confirm(`¿Eliminar ${c.nombre}? Si tiene parcelas o crédito, se vacían también.`);
                if (!forzar) return;
                void supabase.rpc("fn_eliminar_ciclo", { p_id: c.id, p_forzar: true }).then((res) => {
                  if (res.error) throw new Error(res.error.message);
                  return onEliminado(c.id);
                }).catch((e) => window.alert(e instanceof Error ? e.message : String(e)));
              }}>Eliminar</Boton>
            </div>
          </div>
          {editId === c.id && (
            <div className="mt-3">
              <FormCiclo
                inicial={c}
                etiquetaSubmit="Guardar ciclo"
                onListo={async ({ clave, nombre, inicio, fin, presupuesto }) => {
                  const res = await supabase.rpc("fn_editar_ciclo", {
                    p_id: c.id,
                    p_clave: clave,
                    p_nombre: nombre,
                    p_fecha_inicio: inicio || null,
                    p_fecha_fin: fin || null,
                    p_presupuesto: presupuesto ?? 0,
                  });
                  if (res.error) throw new Error(res.error.message);
                  setEditId(null);
                  await onCambio(c.id);
                }}
              />
            </div>
          )}
        </div>
      ))}
      {nuevo ? (
        <div style={{ padding: 12, borderRadius: 10, border: `1px dashed ${C.linea}` }}>
          <div className="mb-2 flex items-center justify-between">
            <span style={{ fontWeight: 700, fontSize: 13 }}>Nuevo ciclo</span>
            <button type="button" onClick={() => setNuevo(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }}>Cerrar</button>
          </div>
          <FormCiclo
            etiquetaSubmit="Abrir ciclo"
            onListo={async ({ clave, nombre, inicio, fin, presupuesto }) => {
              const res = await supabase.rpc("fn_abrir_ciclo", {
                p_clave: clave,
                p_nombre: nombre,
                p_fecha_inicio: inicio || null,
                p_fecha_fin: fin || null,
                p_presupuesto: presupuesto ?? 0,
              });
              if (res.error) throw new Error(res.error.message);
              const id = res.data && typeof res.data === "object" ? res.data.id : null;
              if (!id) throw new Error("No se obtuvo el ciclo.");
              setNuevo(false);
              await onCambio(String(id));
            }}
          />
        </div>
      ) : (
        <Boton secundario onClick={() => { setEditId(null); setNuevo(true); }}>Abrir ciclo vacío</Boton>
      )}
    </div>
  );
}

/* ---------- Simulador de escenarios — por cultivo, unidades reales ---------- */

/* ---------- Simulador de escenarios — por cultivo, unidades reales ---------- */
function Simulador({ parcelasT, costosParcela, inversionTotal, ingresoTotal }) {
  const primeraId = parcelasT.length > 0 ? String(parcelasT[0].id) : "";
  const [sel, setSel] = useState(primeraId);

  const parcela = parcelasT.find(x => String(x.id) === sel) || parcelasT[0];
  const costos = parcela ? costosParcela[parcela.id] : null;

  /* Inicializar inputs desde los datos reales de la parcela */
  const costoHaReal = costos ? costos.porHa : 0;
  const opReal  = costos ? Math.round((costos.labores + costos.nomina + costos.renta) / Math.max(parcela.ha, 1)) : 0;
  const finReal = costos ? Math.round(costos.interes / Math.max(parcela.ha, 1)) : 0;
  const indReal = costos ? Math.round(costos.gastoInd / Math.max(parcela.ha, 1)) : 0;

  const [precio,    setPrecio]    = useState(parcela ? parcela.precioEsperado : 5500);
  const [rend,      setRend]      = useState(parcela ? parcela.rendEsperado   : 10);
  const [costoOp,   setCostoOp]   = useState(opReal);
  const [costoFin,  setCostoFin]  = useState(finReal);
  const [costoInd,  setCostoInd]  = useState(indReal);
  const [selActivo, setSelActivo] = useState(sel);

  /* Cuando cambia la parcela, recargar todos los inputs con los datos reales */
  if (sel !== selActivo) {
    setSelActivo(sel);
    if (parcela) {
      setPrecio(parcela.precioEsperado);
      setRend(parcela.rendEsperado);
      setCostoOp(Math.round((costosParcela[parcela.id].labores + costosParcela[parcela.id].nomina + costosParcela[parcela.id].renta) / Math.max(parcela.ha, 1)));
      setCostoFin(Math.round(costosParcela[parcela.id].interes / Math.max(parcela.ha, 1)));
      setCostoInd(Math.round(costosParcela[parcela.id].gastoInd / Math.max(parcela.ha, 1)));
    }
  }

  if (!parcela || !costos) return <Vacio texto="Registra al menos una parcela con labores para usar el simulador." />;

  const ha = parcela.ha;
  const costoHaTot = (Number(costoOp) || 0) + (Number(costoFin) || 0) + (Number(costoInd) || 0);
  const ingresoHa  = (Number(precio) || 0) * (Number(rend) || 0);
  const utilidadHa = ingresoHa - costoHaTot;
  const precioEq   = (Number(rend) || 0) > 0 ? costoHaTot / Number(rend) : 0;
  const rendEq     = (Number(precio) || 0) > 0 ? costoHaTot / Number(precio) : 0;

  /* 4 escenarios: ±2 ton/ha × ±$500/ton */
  const rA = Number(rend) || 0;
  const rB = Math.max(0, rA - 2);
  const pA = Number(precio) || 0;
  const pB = Math.max(0, pA - 500);
  const escenarios = [
    { label: "Rend. alto · Precio alto", r: rA, p: pA },
    { label: "Rend. alto · Precio bajo", r: rA, p: pB },
    { label: "Rend. bajo · Precio alto", r: rB, p: pA },
    { label: "Rend. bajo · Precio bajo", r: rB, p: pB },
  ].map(e => {
    const ing = e.r * e.p;
    const util = ing - costoHaTot;
    return { ...e, ingresoHa: ing, utilidadHa: util, utilidadTotal: util * ha };
  });

  const inputStyle = { ...estiloInput, textAlign: "right", fontWeight: 700, fontSize: 15 };

  return (
    <Tarjeta style={{ padding: 20, borderTop: `3px solid ${C.azul}` }}>
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal size={16} color={C.azul} />
        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Simulador · ¿qué pasa si…?</span>
      </div>
      <p style={{ fontSize: 13, color: C.gris, marginTop: 0, marginBottom: 12 }}>
        Cada cultivo tiene su propia lógica de costos. Elige la parcela, ajusta los números y ve al instante si las cuentas dan.
      </p>

      {/* Selector de parcela/cultivo */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <Campo label="Cultivo · parcela">
          <select style={{ ...estiloInput, width: "auto", fontWeight: 700 }} value={sel} onChange={e => setSel(e.target.value)}>
            {parcelasT.map(p => (
              <option key={p.id} value={p.id}>
                {p.cultivo} · {p.nombre} · {p.ha} ha
              </option>
            ))}
          </select>
        </Campo>
        <div style={{ fontSize: 12, color: C.gris, paddingTop: 16 }}>
          Costo real registrado: <strong style={{ color: C.tinta }}>{money(costoHaReal)}/ha</strong>
          {costoHaTot !== costoHaReal && costoHaReal > 0 && (
            <span style={{ color: Math.abs(costoHaTot - costoHaReal) / costoHaReal > 0.1 ? C.barrial : C.gris }}>
              {" · simulando "}<strong>{money(costoHaTot)}/ha</strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Mercado */}
        <div className="flex flex-col gap-3">
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 14, color: C.bosque, borderBottom: `1px solid ${C.linea}`, paddingBottom: 6 }}>
            Mercado · {parcela.cultivo}
          </div>
          <Campo label="Precio de venta ($/ton)">
            <input type="number" style={inputStyle} value={precio} onChange={e => setPrecio(Number(e.target.value))} />
          </Campo>
          <Campo label="Rendimiento esperado (ton/ha)">
            <input type="number" style={inputStyle} step="0.5" value={rend} onChange={e => setRend(Number(e.target.value))} />
          </Campo>
          <div style={{ background: C.papel, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
            <div className="flex justify-between">
              <span style={{ color: C.gris }}>Ingreso estimado / ha</span>
              <strong>{money(ingresoHa)}</strong>
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ color: C.gris }}>Ingreso total · {ha} ha</span>
              <strong>{money(ingresoHa * ha)}</strong>
            </div>
          </div>
        </div>

        {/* Costos desglosados */}
        <div className="flex flex-col gap-3">
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 14, color: C.bosque, borderBottom: `1px solid ${C.linea}`, paddingBottom: 6 }}>
            Costos ($/ha) · {parcela.cultivo}
          </div>
          <Campo label="Operación directa (labores, insumos, jornales, renta tierra)">
            <input type="number" style={inputStyle} value={costoOp} onChange={e => setCostoOp(Number(e.target.value))} />
          </Campo>
          <Campo label="Costo financiero (avío + compras financiadas)">
            <input type="number" style={inputStyle} value={costoFin} onChange={e => setCostoFin(Number(e.target.value))} />
          </Campo>
          <Campo label="Gastos indirectos prorrateados (sueldos, gasolina, seguros…)">
            <input type="number" style={inputStyle} value={costoInd} onChange={e => setCostoInd(Number(e.target.value))} />
          </Campo>
          <div style={{ background: C.papel, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
            <div className="flex justify-between">
              <span style={{ color: C.gris }}>Costo total / ha</span>
              <strong>{money(costoHaTot)}</strong>
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ color: C.gris }}>Costo total · {ha} ha</span>
              <strong>{money(costoHaTot * ha)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div className="mt-4 p-4" style={{ background: utilidadHa >= 0 ? "#EEF4EB" : "#FBEEE9", borderRadius: 12 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Utilidad / ha",                v: money(utilidadHa),       grande: true,  ok: utilidadHa >= 0 },
            { l: `Utilidad total · ${ha} ha`,    v: money(utilidadHa * ha),  grande: true,  ok: utilidadHa >= 0 },
            { l: "Precio mínimo (equilibrio)",   v: money(precioEq) + "/ton",grande: false },
            { l: "Rend. mínimo (equilibrio)",    v: num(rendEq, 2) + " ton/ha", grande: false },
          ].map(k => (
            <div key={k.l}>
              <div style={{ fontSize: 11, color: C.gris, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
              <div style={{ fontFamily: k.grande ? fuente.display : fuente.cuerpo, fontWeight: 800, fontSize: k.grande ? 19 : 14, color: k.grande ? (k.ok ? C.bosque : C.rojo) : C.tinta, marginTop: 2 }}>
                {k.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 escenarios */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          4 escenarios · {parcela.cultivo} · rend. ±2 ton/ha × precio ±$500/ton
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: C.gris, textAlign: "left" }}>
                <th className="py-2 pr-3 font-semibold">Escenario</th>
                <th className="py-2 pr-3 font-semibold">Rend.</th>
                <th className="py-2 pr-3 font-semibold">Precio</th>
                <th className="py-2 pr-3 font-semibold">Ingreso/ha</th>
                <th className="py-2 font-semibold">Utilidad/ha</th>
              </tr>
            </thead>
            <tbody>
              {escenarios.map(e => (
                <tr key={e.label} style={{ borderTop: `1px solid ${C.linea}` }}>
                  <td className="py-2.5 pr-3" style={{ fontWeight: 600, fontSize: 12 }}>{e.label}</td>
                  <td className="py-2.5 pr-3">{num(e.r, 1)} ton/ha</td>
                  <td className="py-2.5 pr-3">{money(e.p)}/ton</td>
                  <td className="py-2.5 pr-3">{money(e.ingresoHa)}</td>
                  <td className="py-2.5" style={{ fontWeight: 700, color: e.utilidadHa >= 0 ? C.bosque : C.rojo }}>
                    {money(e.utilidadHa)}
                    <span style={{ fontSize: 11, color: C.gris, fontWeight: 400 }}> ({money(e.utilidadTotal)} total)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: C.gris, marginTop: 6, marginBottom: 0 }}>
          Los costos de los 4 escenarios son los que ingresaste arriba. Los inputs se cargan automáticamente desde el registro real cada vez que cambias de cultivo.
        </p>
      </div>
    </Tarjeta>
  );
}

/* ---------- Reportes ---------- */

function Reportes({ parcelasT, laboresT, nominaT, insumos, gastosT, apsProductivas = [], prestamosT = [], productores = [], costoFinTotal, inversionTotal, costoDirectoTotal, gastosIndTotal, ingresoTotal, ingresoRealTotal, rentaTotal, haTotal, dieselUsado, dieselCosto, costosParcela }) {
  const nominaTotal = nominaT.reduce((s, n) => s + n.personas * n.dias * n.pago, 0);
  const jornalesTot = nominaT.reduce((s, n) => s + n.personas * n.dias, 0);

  const porTipo = {};
  laboresT.forEach(l => { porTipo[l.tipo] = (porTipo[l.tipo] || 0) + costoLabor(l); });

  const porCategoriaInsumo = {};
  laboresT.forEach(l => {
    if (l.insumoId && l.costoInsumo) {
      const cat = insumos.find(i => i.id === l.insumoId)?.categoria || "Otro insumo";
      porCategoriaInsumo[cat] = (porCategoriaInsumo[cat] || 0) + l.costoInsumo;
    }
  });
  const porCatGasto = {};
  gastosT.forEach(g => { porCatGasto[g.categoria] = (porCatGasto[g.categoria] || 0) + g.monto; });

  const opTotal = laboresT.reduce((s, l) => s + (l.costoOp || 0), 0);

  /* Armar movimientos detallados por concepto */
  const movMaquila = laboresT.filter(l => l.costoOp > 0).map(l => {
    const p = parcelasT.find(x => x.id === l.parcelaId);
    return { fecha: l.fecha, desc: l.tipo + (l.desc ? " · " + l.desc : ""), parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: l.costoOp };
  });

  const movInsumosPorCat = {};
  laboresT.forEach(l => {
    if (!l.insumoId || !l.costoInsumo) return;
    const ins = insumos.find(i => i.id === l.insumoId);
    const cat = ins?.categoria || "Otro insumo";
    const p = parcelasT.find(x => x.id === l.parcelaId);
    if (!movInsumosPorCat[cat]) movInsumosPorCat[cat] = [];
    movInsumosPorCat[cat].push({ fecha: l.fecha, desc: num(l.cantidad, 1) + " " + (ins?.unidad || "") + " " + (ins?.nombre || ""), parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: l.costoInsumo });
  });

  const movDiesel = laboresT.filter(l => l.costoDiesel > 0).map(l => {
    const p = parcelasT.find(x => x.id === l.parcelaId);
    return { fecha: l.fecha, desc: l.tipo + " · " + num(l.litrosDiesel || 0, 0) + " L", parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: l.costoDiesel };
  });

  const movNomina = nominaT.map(n => {
    const p = parcelasT.find(x => x.id === n.parcelaId);
    return { fecha: n.fecha, desc: n.cuadrilla + " · " + n.actividad + " (" + n.personas + "p × " + n.dias + "d)", parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: n.personas * n.dias * n.pago };
  });

  const movRenta = parcelasT.filter(p => p.tenencia === "Rentada").map(p => ({
    fecha: p.fechaRenta || "—", desc: "Renta " + num(p.ha, 0) + " ha × " + money(p.rentaPorHa) + "/ha", parcela: p.cultivo + " · " + p.nombre, monto: p.ha * (p.rentaPorHa || 0)
  }));

  const movGastosPorCat = {};
  gastosT.forEach(g => {
    if (!movGastosPorCat[g.categoria]) movGastosPorCat[g.categoria] = [];
    movGastosPorCat[g.categoria].push({ fecha: g.fecha, desc: g.desc, parcela: g.destino === "parcela" ? (parcelasT.find(x => x.id === g.parcelaId)?.nombre || "—") : g.destino === "prorrateo" ? "Prorrateado" : "General", monto: g.monto });
  });

  const conceptos = [
    { nombre: "Maquila y servicios", valor: opTotal, color: C.hoja, movimientos: movMaquila },
    ...Object.entries(porCategoriaInsumo).map(([k, v]) => ({ nombre: k, valor: v, color: C.bosque, movimientos: movInsumosPorCat[k] || [] })),
    { nombre: "Diésel", valor: dieselCosto, color: C.barrial, movimientos: movDiesel },
    { nombre: "Jornales (raya)", valor: nominaTotal, color: C.azul, movimientos: movNomina },
    { nombre: "Renta de tierra", valor: rentaTotal, color: "#8C7A4A", movimientos: movRenta },
    ...Object.entries(porCatGasto).map(([k, v]) => ({ nombre: k, valor: v, color: "#7E8B9A", movimientos: movGastosPorCat[k] || [] })),
    { nombre: "Aplicaciones de préstamos (productivas)", valor: apsProductivas.reduce((s, a) => s + a.monto, 0), color: C.barrial,
      movimientos: apsProductivas.map(a => {
        const pp = prestamosT.find(x => x.id === a.prestamoId);
        const pr = pp ? productores.find(x => x.id === pp.productorId) : null;
        const p = a.parcelaId ? parcelasT.find(x => x.id === a.parcelaId) : null;
        return { fecha: a.fecha, desc: a.concepto + (pr ? " · préstamo " + pr.codigo : ""), parcela: a.destino === "parcela" ? (p?.nombre || "—") : "Prorrateado", monto: a.monto };
      }) },
    { nombre: "Costo financiero", valor: costoFinTotal, color: C.grano, movimientos: [] },
  ].map(c => ({ ...c, pct: inversionTotal > 0 ? (c.valor / inversionTotal) * 100 : 0 }));

  const tiposLista = Object.entries(porTipo).map(([k, v]) => {
    const movs = laboresT.filter(l => l.tipo === k).map(l => {
      const p = parcelasT.find(x => x.id === l.parcelaId);
      return { fecha: l.fecha, desc: l.desc || k, parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: costoLabor(l) };
    });
    return { nombre: k, valor: v, pct: inversionTotal > 0 ? (v / inversionTotal) * 100 : 0, movimientos: movs };
  });

  const utilidad = ingresoTotal - inversionTotal;
  const margen = ingresoTotal > 0 ? (utilidad / ingresoTotal) * 100 : 0;

  const kpis = [
    { l: "Costo completo / ha", v: money(haTotal ? inversionTotal / haTotal : 0) },
    { l: "% costo financiero", v: `${num(inversionTotal ? (costoFinTotal / inversionTotal) * 100 : 0, 1)}%` },
    { l: "% gastos indirectos", v: `${num(inversionTotal ? (gastosIndTotal / inversionTotal) * 100 : 0, 1)}%` },
    { l: "Jornales totales", v: num(jornalesTot, 0) },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <Tarjeta key={i} style={{ padding: 16, borderTop: `3px solid ${C.bosque}` }}>
            <Etiqueta>{k.l}</Etiqueta>
            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 22, marginTop: 4 }}>{k.v}</div>
          </Tarjeta>
        ))}
      </div>

      <Tarjeta style={{ padding: 20 }}>
        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Estado de resultados de la temporada</span>
        <div className="mt-3 max-w-md">
          <Fila l="Ingresos esperados (proyección)" v={money(ingresoTotal)} />
          <div style={{ height: 6 }} />
          {ingresoRealTotal > 0 && <><Fila l="Ingreso real cosechado (neto)" v={money(ingresoRealTotal)} /><div style={{ height: 6 }} /></>}
          <Fila l="(−) Costos directos (incluye renta)" v={money(costoDirectoTotal)} />
          <div style={{ height: 6 }} />
          <Fila l="(−) Gastos indirectos" v={money(gastosIndTotal)} />
          <div style={{ height: 6 }} />
          <Fila l="(−) Costo financiero" v={money(costoFinTotal)} resalta />
          <div style={{ height: 10 }} />
          <div className="flex justify-between" style={{ borderTop: `2px solid ${C.tinta}`, paddingTop: 8 }}>
            <span style={{ fontWeight: 700 }}>Utilidad proyectada</span>
            <span style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, color: utilidad >= 0 ? C.bosque : C.rojo }}>
              {money(utilidad)} <span style={{ fontSize: 12, color: C.gris, fontWeight: 600 }}>({num(margen, 1)}% margen)</span>
            </span>
          </div>
        </div>
      </Tarjeta>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta style={{ padding: 20 }}>
          <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>¿En qué se va el dinero? · por concepto</span>
          <div className="mt-3"><BarraLista datos={conceptos} /></div>
        </Tarjeta>
        <Tarjeta style={{ padding: 20 }}>
          <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Costo por tipo de labor</span>
          <div className="mt-3"><BarraLista datos={tiposLista} /></div>
        </Tarjeta>
      </div>

      <Tarjeta style={{ padding: 20 }}>
        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Comparativo entre parcelas</span>
        <div className="overflow-x-auto mt-3">
          <table className="w-full" style={{ fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: C.gris, textAlign: "left" }}>
                <th className="py-2 pr-3 font-semibold">Cultivo</th>
                <th className="py-2 pr-3 font-semibold">ha</th>
                <th className="py-2 pr-3 font-semibold">Directo/ha</th>
                <th className="py-2 pr-3 font-semibold">Completo/ha</th>
                <th className="py-2 font-semibold">Rend. real</th>
              </tr>
            </thead>
            <tbody>
              {parcelasT.map(p => {
                const c = costosParcela[p.id];
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.linea}` }}>
                    <td className="py-2.5 pr-3" style={{ fontWeight: 600 }}>{p.cultivo} <span style={{ color: C.gris, fontWeight: 400 }}>· {p.nombre}</span></td>
                    <td className="py-2.5 pr-3">{p.ha}</td>
                    <td className="py-2.5 pr-3">{money(c.directoPorHa)}</td>
                    <td className="py-2.5 pr-3">{money(c.porHa)}</td>
                    <td className="py-2.5">{c.tonReal > 0 ? `${num(c.rendReal, 2)} ton/ha` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: C.gris, marginBottom: 0 }}>Directo: lo que costó operar ese lote. Completo: con indirectos prorrateados y costo financiero — el número real del negocio.</p>
      </Tarjeta>
    </>
  );
}


/* ---------- Formularios ---------- */

function FormNomina({ inicial, parcelas, directorio, onGuardar }) {
  const [f, set, setF] = useForm({
    fecha: inicial?.fecha || hoyStr, tipo: inicial?.tipo || "Cuadrilla",
    cuadrilla: inicial?.cuadrilla || "", actividad: inicial?.actividad || "",
    parcelaId: inicial?.parcelaId || parcelas[0]?.id || "",
    personas: inicial?.personas ?? "", dias: inicial?.dias ?? "", pago: inicial?.pago ?? "",
    seleccion: inicial ? "manual" : "",
  });
  const elegirDelDirectorio = (e) => {
    const v = e.target.value;
    if (v === "" || v === "manual") { setF(prev => ({ ...prev, seleccion: v, cuadrilla: v === "manual" ? "" : prev.cuadrilla })); return; }
    const d = directorio.find(x => x.nombre === v);
    setF(prev => ({ ...prev, seleccion: v, cuadrilla: d.nombre, tipo: d.tipo, pago: d.pago }));
  };
  const jornales = (Number(f.personas) || 0) * (Number(f.dias) || 0);
  const total = jornales * (Number(f.pago) || 0);
  const manual = f.seleccion === "manual" || inicial;
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha (o inicio de la semana)"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      {!inicial && (
        <Campo label="Persona / cuadrilla (del directorio)">
          <select style={estiloInput} value={f.seleccion} onChange={elegirDelDirectorio}>
            <option value="">— Elige —</option>
            {directorio.map(d => <option key={d.nombre} value={d.nombre}>{d.nombre} ({d.tipo})</option>)}
            <option value="manual">+ Nueva persona / cuadrilla</option>
          </select>
        </Campo>
      )}
      {manual && (
        <>
          <Campo label="Tipo">
            <select style={estiloInput} value={f.tipo} onChange={set("tipo")}>
              <option>Cuadrilla</option>
              <option>Operador</option>
            </select>
          </Campo>
          <Campo label={f.tipo === "Operador" ? "Operador (nombre)" : "Cuadrilla (nombre)"}>
            <input style={estiloInput} placeholder={f.tipo === "Operador" ? "Ej. Juan · tractorista" : "Ej. Cuadrilla Don Beto"} value={f.cuadrilla} onChange={set("cuadrilla")} />
          </Campo>
        </>
      )}
      <Campo label="Actividad"><input style={estiloInput} placeholder="Ej. Rastreo / deshierbe" value={f.actividad} onChange={set("actividad")} /></Campo>
      <div className="md:col-span-3"><Campo label="Parcela"><PickerParcela parcelas={parcelas} value={f.parcelaId} onChange={set("parcelaId")} /></Campo></div>
      <Campo label="Personas"><input type="number" style={estiloInput} placeholder={f.tipo === "Operador" ? "1" : "Ej. 6"} value={f.personas} onChange={set("personas")} /></Campo>
      <Campo label="Días trabajados"><input type="number" style={estiloInput} placeholder="Ej. 5" value={f.dias} onChange={set("dias")} /></Campo>
      <Campo label="Pago por día (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 650" value={f.pago} onChange={set("pago")} /></Campo>
      <div className="flex items-end md:col-span-2 gap-3 flex-wrap">
        <div style={{ fontSize: 13, color: C.gris, paddingBottom: 8 }}>
          = <strong style={{ color: C.tinta }}>{jornales} jornales</strong>{total > 0 ? <> · a pagar en raya: <strong style={{ color: C.tinta }}>{money(total)}</strong></> : null}
        </div>
        <Boton onClick={() => f.cuadrilla && f.parcelaId && onGuardar(f)}>{inicial ? "Guardar cambios" : "Guardar trabajo"}</Boton>
      </div>
    </div>
  );
}

function FormCredito({ inicial, productores, onGuardar }) {
  const [f, set] = useForm({
    tipoCredito: inicial?.tipoCredito || "Directo",
    fuente: inicial?.fuente || "", destino: inicial?.destino || "", monto: inicial?.monto ?? "",
    tiie: inicial?.tiie ?? "", spread: inicial?.spread ?? "",
    comision: inicial?.comision ?? "", fega: inicial?.fega ?? "",
    fechaInicio: inicial?.fechaInicio || hoyStr,
    fechaVencimiento: inicial?.fechaVencimiento || "",
    productorId: inicial?.productorId || "",
  });
  const tasa = (Number(f.tiie) || 0) + (Number(f.spread) || 0);
  const plazo = f.fechaVencimiento ? diasEntre(f.fechaInicio, f.fechaVencimiento) : 0;
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Tipo de financiamiento">
        <select style={estiloInput} value={f.tipoCredito} onChange={set("tipoCredito")}>
          <option>Directo</option>
          <option>Parafinanciero</option>
        </select>
      </Campo>
      <Campo label="Fuente"><input style={estiloInput} placeholder="Ej. Financiera fondeada FIRA" value={f.fuente} onChange={set("fuente")} /></Campo>
      <Campo label="Destino"><input style={estiloInput} placeholder="Ej. Maíz O-I" value={f.destino} onChange={set("destino")} /></Campo>
      <CampoProductor value={f.productorId} onChange={set("productorId")} productores={productores} />
      <Campo label="Monto ministrado (MXN)"><input type="number" style={estiloInput} placeholder="0" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="Tasa de referencia (TIIE) %"><input type="number" style={estiloInput} placeholder="Ej. 11.25" value={f.tiie} onChange={set("tiie")} /></Campo>
      <Campo label="Spread (%) según contrato"><input type="number" style={estiloInput} placeholder="Ej. 5" value={f.spread} onChange={set("spread")} /></Campo>
      <Campo label="Comisión por apertura (%) · se liquida a cosecha"><input type="number" style={estiloInput} placeholder="Ej. 1" value={f.comision} onChange={set("comision")} /></Campo>
      <Campo label="Prima FEGA (% anual) · cobro único por plazo"><input type="number" style={estiloInput} placeholder="Ej. 1.4 (0 si no aplica)" value={f.fega} onChange={set("fega")} /></Campo>
      <Campo label="Fecha de ministración"><input type="date" style={estiloInput} value={f.fechaInicio} onChange={set("fechaInicio")} /></Campo>
      <Campo label="Fecha de vencimiento"><input type="date" style={estiloInput} value={f.fechaVencimiento} onChange={set("fechaVencimiento")} /></Campo>
      <div className="flex items-end md:col-span-2 gap-3 flex-wrap">
        {tasa > 0 && <div style={{ fontSize: 13, color: C.gris, paddingBottom: 8 }}>Tasa: <strong style={{ color: C.tinta }}>{num(tasa, 2)}%</strong>{plazo > 0 ? <> · plazo <strong style={{ color: C.tinta }}>{plazo} días</strong></> : null}</div>}
        <Boton onClick={() => f.fuente && f.monto && f.fechaVencimiento && onGuardar(f)}>{inicial ? "Guardar cambios" : "Guardar crédito"}</Boton>
      </div>
    </div>
  );
}

function FormBoleta({ inicial, parcelas, onGuardar, veFinanzas = true }) {
  const [f, set] = useForm({
    parcelaId: inicial?.parcelaId || parcelas[0]?.id || "",
    fecha: inicial?.fecha || hoyStr,
    bodega: inicial?.bodega || "", boleta: inicial?.boleta || "",
    pesoBruto: inicial?.pesoBruto ?? "", tara: inicial?.tara ?? "",
    humedad: inicial?.humedad ?? "", impurezas: inicial?.impurezas ?? "",
    hStd: inicial?.hStd ?? 14, iStd: inicial?.iStd ?? 2,
    precioTon: inicial?.precioTon ?? "",
    trilla: inicial?.trilla ?? "", flete: inicial?.flete ?? "", otros: inicial?.otros ?? "",
  });
  const c = calcBoleta(f);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <div className="md:col-span-3"><Campo label="Parcela"><PickerParcela parcelas={parcelas} value={f.parcelaId} onChange={set("parcelaId")} /></Campo></div>
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Bodega / almacén"><input style={estiloInput} placeholder="Ej. Almacenadora El Carrizo" value={f.bodega} onChange={set("bodega")} /></Campo>
      <Campo label="No. de boleta"><input style={estiloInput} placeholder="Ej. 78214" value={f.boleta} onChange={set("boleta")} /></Campo>
      <Campo label="Peso bruto (kg)"><input type="number" inputMode="decimal" style={estiloInput} placeholder="Ej. 41800" value={f.pesoBruto} onChange={set("pesoBruto")} /></Campo>
      <Campo label="Tara (kg)"><input type="number" inputMode="decimal" style={estiloInput} placeholder="Ej. 13900" value={f.tara} onChange={set("tara")} /></Campo>
      <Campo label={`Humedad (%) · estándar ${f.hStd}%`}><input type="number" inputMode="decimal" style={estiloInput} placeholder="Ej. 15.5" value={f.humedad} onChange={set("humedad")} /></Campo>
      <Campo label={`Impurezas (%) · estándar ${f.iStd}%`}><input type="number" inputMode="decimal" style={estiloInput} placeholder="Ej. 2.8" value={f.impurezas} onChange={set("impurezas")} /></Campo>
      {veFinanzas && (
        <>
          <Campo label="Precio ($/ton)"><input type="number" inputMode="decimal" style={estiloInput} placeholder="Ej. 5650" value={f.precioTon} onChange={set("precioTon")} /></Campo>
          <Campo label="Estándar humedad (%)"><input type="number" style={estiloInput} value={f.hStd} onChange={set("hStd")} /></Campo>
          <Campo label="Estándar impurezas (%)"><input type="number" style={estiloInput} value={f.iStd} onChange={set("iStd")} /></Campo>
          <Campo label="Flete del viaje (MXN)"><input type="number" inputMode="decimal" style={estiloInput} placeholder="Ej. 4200" value={f.flete} onChange={set("flete")} /></Campo>
          <Campo label="Trilla por ton (MXN, opcional)"><input type="number" style={estiloInput} placeholder="0 si pagas maquila/ha" value={f.trilla} onChange={set("trilla")} /></Campo>
          <Campo label="Secado / maniobras / otros (MXN)"><input type="number" style={estiloInput} placeholder="0" value={f.otros} onChange={set("otros")} /></Campo>
        </>
      )}
      {c.neto > 0 && (
        <div className="md:col-span-3" style={{ background: "#EEF4EB", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.bosque }}>
          Neto {num(c.neto, 0)} kg − humedad {num(c.descH, 0)} kg − impurezas {num(c.descI, 0)} kg = <strong>{num(c.pagable, 0)} kg pagables ({num(c.ton, 2)} ton)</strong>
          {veFinanzas && c.ingresoBruto > 0 ? <> → bruto <strong>{money(c.ingresoBruto)}</strong> − deducciones {money(c.deducciones)} = <strong>{money(c.ingresoNeto)}</strong></> : null}
        </div>
      )}
      <div className="flex items-end"><Boton onClick={() => f.parcelaId && f.pesoBruto && onGuardar(f)}>{inicial ? "Guardar cambios" : "Guardar boleta"}</Boton></div>
    </div>
  );
}

function FormGasto({ inicial, parcelas, productores, creditos, onGuardar }) {
  const [f, set] = useForm({
    fecha: inicial?.fecha || hoyStr,
    categoria: inicial?.categoria || CAT_GASTO[0],
    desc: inicial?.desc || "",
    monto: inicial?.monto ?? "",
    destino: inicial?.destino || "prorrateo",
    parcelaId: inicial?.parcelaId || parcelas[0]?.id || "",
    productorId: inicial?.productorId || "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
    tasa: inicial?.tasa ?? "",
  });
  const bloqueado = !f.monto || (f.origen === "linea" && !f.creditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Categoría"><select style={estiloInput} value={f.categoria} onChange={set("categoria")}>{CAT_GASTO.map(c => <option key={c}>{c}</option>)}</select></Campo>
      <Campo label="Descripción"><input style={estiloInput} placeholder="Ej. Gasolina camionetas · junio" value={f.desc} onChange={set("desc")} /></Campo>
      <Campo label="Monto (MXN)"><input type="number" style={estiloInput} placeholder="0" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿Cómo se reparte?">
        <select style={estiloInput} value={f.destino} onChange={set("destino")}>
          <option value="prorrateo">Prorratear por hectárea (todas las parcelas)</option>
          <option value="parcela">Asignar a una parcela específica</option>
          <option value="general">General (no afecta costo/ha)</option>
        </select>
      </Campo>
      {f.destino === "parcela" && (
        <Campo label="Parcela"><select style={estiloInput} value={f.parcelaId} onChange={set("parcelaId")}>{parcelas.map(p => <option key={p.id} value={p.id}>{p.cultivo} · {p.nombre}</option>)}</select></Campo>
      )}
      <CampoProductor value={f.productorId} onChange={set("productorId")} productores={productores} />
      <CampoFinanciamiento
        origen={f.origen} creditoId={f.creditoId} tasa={f.tasa}
        onOrigen={set("origen")} onCredito={set("creditoId")} onTasa={set("tasa")}
        creditos={creditos} labelExterno="Crédito de proveedor" placeholderTasa="Ej. 22" />
      <div className="flex items-end"><Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Guardar gasto"}</Boton></div>
    </div>
  );
}

/* ---------- Caja chica: fondeo (entra efectivo) ---------- */
function FormCajaFondeo({ inicial, creditos, onGuardar }) {
  const [f, set] = useForm({
    fecha: inicial?.fecha || hoyStr,
    monto: inicial?.monto ?? "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
    nota: inicial?.nota || "",
  });
  const sinLineas = !creditos || creditos.length === 0;
  const bloqueado = !f.monto || (f.origen === "linea" && !f.creditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Monto que entra a la caja (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 20000" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿De dónde sale el efectivo?">
        <select style={estiloInput} value={sinLineas && f.origen === "linea" ? "propio" : f.origen} onChange={set("origen")}>
          <option value="propio">Recurso propio</option>
          {!sinLineas ? <option value="linea">De una línea de crédito</option> : null}
        </select>
      </Campo>
      {f.origen === "linea" && (
        <Campo label="¿Cuál línea?">
          {sinLineas ? (
            <div style={{ fontSize: 12, color: C.barrial, padding: "8px 0" }}>No hay líneas registradas.</div>
          ) : (
            <select style={estiloInput} value={f.creditoId} onChange={set("creditoId")}>
              <option value="">— Elige línea —</option>
              {creditos.map(c => <option key={c.id} value={c.id}>{c.tipoCredito} · {c.fuente}</option>)}
            </select>
          )}
        </Campo>
      )}
      <Campo label="Nota (opcional)"><input style={estiloInput} placeholder="Ej. Fondeo de junio" value={f.nota} onChange={set("nota")} /></Campo>
      <div className="flex items-end"><Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Fondear caja"}</Boton></div>
    </div>
  );
}

/* ---------- Caja chica: salida (gasto en efectivo, nace pendiente) ---------- */
function FormCajaSalida({ inicial, parcelas, onGuardar }) {
  const [f, set, setF] = useForm({
    fecha: inicial?.fecha || hoyStr,
    monto: inicial?.monto ?? "",
    concepto: inicial?.concepto || "",
    quien: inicial?.quien || "",
    destino: inicial?.destino || "prorrateo",
    parcelaId: inicial?.parcelaId || parcelas[0]?.id || "",
    comprobante: inicial?.comprobante ?? false,
  });
  const bloqueado = !f.monto || !f.concepto.trim();
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Concepto"><input style={estiloInput} placeholder="Ej. Refacción, comida, acarreo…" value={f.concepto} onChange={set("concepto")} /></Campo>
      <Campo label="Monto (MXN)"><input type="number" style={estiloInput} placeholder="0" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿Quién gastó?"><input style={estiloInput} placeholder="Ej. Ramiro" value={f.quien} onChange={set("quien")} /></Campo>
      <Campo label="¿Cómo se reparte?">
        <select style={estiloInput} value={f.destino} onChange={set("destino")}>
          <option value="prorrateo">Prorratear por hectárea</option>
          <option value="parcela">Asignar a una parcela</option>
          <option value="general">General (no afecta costo/ha)</option>
        </select>
      </Campo>
      {f.destino === "parcela" && (
        <Campo label="Parcela"><select style={estiloInput} value={f.parcelaId} onChange={set("parcelaId")}>{parcelas.map(p => <option key={p.id} value={p.id}>{p.cultivo} · {p.nombre}</option>)}</select></Campo>
      )}
      <label className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: C.gris, paddingTop: 18 }}>
        <input type="checkbox" checked={f.comprobante} onChange={(e) => setF(prev => ({ ...prev, comprobante: e.target.checked }))} style={{ width: 16, height: 16, accentColor: C.bosque }} />
        Tiene comprobante / factura
      </label>
      <div className="flex items-end"><Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Registrar salida"}</Boton></div>
    </div>
  );
}

/* ---------- Tarjeta de productor con estado de cuenta ---------- */
function ProductorCard({ pr, cuenta, parcelasPr, creditosPr, infoLinea, puedeEditar, onEditar, onEliminar, onEditarDispersion, onEliminarDispersion }) {
  const [abierto, setAbierto] = useState(false);
  const esGrupo = pr.tipo === "Grupo";
  const movs = [
    ...cuenta.cargos.map(m => ({ ...m, esCargo: true })),
    ...cuenta.abonos.map(m => ({ ...m, esCargo: false }))
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <Tarjeta style={{ padding: 18, borderTop: "3px solid " + (esGrupo ? C.azul : C.bosque) }}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>{pr.nombre}</span>
            <span style={{ background: esGrupo ? "#E8EEF5" : "#E8F1E6", color: esGrupo ? C.azul : C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{pr.tipo}</span>
          </div>
          <div style={{ fontSize: 12, color: C.gris }}>
            Código {pr.codigo}{pr.contrato ? " · Contrato " + pr.contrato : ""}{pr.rfc ? " · " + pr.rfc : ""}
          </div>
          {parcelasPr.length > 0 && (
            <div style={{ fontSize: 12, color: C.gris }}>
              {parcelasPr.length} parcela(s) · {num(parcelasPr.reduce((s, p) => s + p.ha, 0), 1)} ha a su nombre
            </div>
          )}
        </div>
        {puedeEditar && <Acciones onEditar={onEditar} onEliminar={onEliminar} />}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { l: "Cargos", v: cuenta.totalCargos, color: C.barrial },
          { l: "Abonos", v: cuenta.totalAbonos, color: C.hoja },
          { l: "Por liquidar", v: cuenta.saldo, color: cuenta.saldo > 0 ? C.rojo : C.bosque },
        ].map(k => (
          <div key={k.l} style={{ background: C.papel, borderRadius: 10, padding: "8px 10px" }}>
            <Etiqueta>{k.l}</Etiqueta>
            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 15, color: k.color }}>{money(k.v)}</div>
          </div>
        ))}
      </div>

      {creditosPr.length > 0 && (
        <div className="mt-2" style={{ fontSize: 12, color: C.gris }}>
          Línea a su contrato: {creditosPr.map(cr => { const i = infoLinea ? infoLinea(cr) : { dispuesto: 0, costo: 0 }; return cr.fuente + " · dispuesto " + money(i.dispuesto) + " (costo fin. " + money(i.costo) + ")"; }).join(" · ")}.
          Los accesorios se liquidan a cosecha; no se cargan aquí todavía.
        </div>
      )}

      <div className="mt-3">
        <Boton chico secundario onClick={() => setAbierto(!abierto)}>
          {abierto ? "Ocultar estado de cuenta" : "Ver estado de cuenta (" + movs.length + " mov.)"}
        </Boton>
      </div>

      {abierto && (
        <div className="overflow-x-auto mt-3">
          {movs.length === 0 && <div style={{ fontSize: 13, color: C.gris }}>Sin movimientos esta temporada.</div>}
          {movs.length > 0 && (
            <table className="w-full" style={{ fontSize: 12.5, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: C.gris, textAlign: "left" }}>
                  <th className="py-1.5 pr-2 font-semibold">Fecha</th>
                  <th className="py-1.5 pr-2 font-semibold">Movimiento</th>
                  <th className="py-1.5 pr-2 font-semibold" style={{ textAlign: "right" }}>Cargo</th>
                  <th className="py-1.5 pr-2 font-semibold" style={{ textAlign: "right" }}>Abono</th>
                  <th className="py-1.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {movs.map(m => (
                  <tr key={m.id} style={{ borderTop: "1px solid " + C.linea }}>
                    <td className="py-1.5 pr-2" style={{ whiteSpace: "nowrap" }}>{m.fecha}</td>
                    <td className="py-1.5 pr-2">
                      <span style={{ fontWeight: 600 }}>{m.origen}</span>
                      <span style={{ color: C.gris }}> · {m.desc}</span>
                    </td>
                    <td className="py-1.5 pr-2" style={{ textAlign: "right", color: C.barrial, fontWeight: m.esCargo ? 700 : 400 }}>
                      {m.esCargo ? money(m.monto) : ""}
                    </td>
                    <td className="py-1.5 pr-2" style={{ textAlign: "right", color: C.bosque, fontWeight: !m.esCargo ? 700 : 400 }}>
                      {!m.esCargo ? money(m.monto) : ""}
                    </td>
                    <td className="py-1.5" style={{ textAlign: "right" }}>
                      {puedeEditar && onEditarDispersion && m.origen === "Dispersión" && (
                        <Acciones onEditar={() => onEditarDispersion(m)} onEliminar={() => onEliminarDispersion(m)} />
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid " + C.tinta }}>
                  <td className="py-2 pr-2" colSpan={2} style={{ fontWeight: 700 }}>Saldo por liquidar</td>
                  <td className="py-2 pr-2" style={{ textAlign: "right", fontWeight: 700, color: C.barrial }}>{money(cuenta.totalCargos)}</td>
                  <td className="py-2 pr-2" style={{ textAlign: "right", fontWeight: 700, color: C.bosque }}>{money(cuenta.totalAbonos)}</td>
                  <td className="py-2" style={{ textAlign: "right", fontFamily: fuente.display, fontWeight: 800, color: cuenta.saldo > 0 ? C.rojo : C.bosque }}>{money(cuenta.saldo)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <p style={{ fontSize: 11, color: C.gris, marginTop: 6, marginBottom: 0 }}>
            Compras y gastos se editan en su módulo; aquí solo se editan las dispersiones en efectivo.
          </p>
        </div>
      )}
    </Tarjeta>
  );
}

/* ---------- Formulario: nuevo/editar productor ---------- */
function FormProductor({ inicial, onGuardar }) {
  const [f, set] = useForm({
    codigo: inicial?.codigo || "",
    nombre: inicial?.nombre || "",
    contrato: inicial?.contrato || "",
    rfc: inicial?.rfc || "",
    tipo: inicial?.tipo || "Prestanombre",
  });
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Nombre completo"><input style={estiloInput} placeholder="Ej. Galaviz Ruiz Anabell" value={f.nombre} onChange={set("nombre")} /></Campo>
      <Campo label="Código de cliente"><input style={estiloInput} placeholder="Ej. 3567" value={f.codigo} onChange={set("codigo")} /></Campo>
      <Campo label="No. de contrato (financiera)"><input style={estiloInput} placeholder="Ej. 107" value={f.contrato} onChange={set("contrato")} /></Campo>
      <Campo label="RFC (opcional)"><input style={estiloInput} placeholder="Ej. GARA720523I89" value={f.rfc} onChange={set("rfc")} /></Campo>
      <Campo label="Tipo">
        <select style={estiloInput} value={f.tipo} onChange={set("tipo")}>
          <option>Prestanombre</option>
          <option>Grupo</option>
        </select>
      </Campo>
      <div className="flex items-end">
        <Boton onClick={() => f.nombre && f.codigo && onGuardar(f)}>{inicial ? "Guardar cambios" : "Guardar productor"}</Boton>
      </div>
    </div>
  );
}

/* ---------- Formulario: dispersión en efectivo ---------- */
function FormDispersion({ inicial, productores, creditos, onGuardar }) {
  const [f, set] = useForm({
    productorId: inicial?.productorId || (productores[0] ? productores[0].id : ""),
    fecha: inicial?.fecha || hoyStr,
    concepto: inicial?.concepto || CONCEPTOS_DISPERSION[0],
    monto: inicial?.monto ?? "",
    observacion: inicial?.observacion || "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
  });
  const sinLineas = !creditos || creditos.length === 0;
  const bloqueado = !f.productorId || !f.monto || (f.origen === "linea" && !f.creditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Productor (código de cliente)">
        <select style={estiloInput} value={f.productorId} onChange={set("productorId")}>
          {productores.map(pr => <option key={pr.id} value={pr.id}>{pr.codigo} · {pr.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Concepto">
        <select style={estiloInput} value={f.concepto} onChange={set("concepto")}>
          {CONCEPTOS_DISPERSION.map(c => <option key={c}>{c}</option>)}
        </select>
      </Campo>
      <Campo label="Monto (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 93000" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿De dónde sale el dinero?">
        <select style={estiloInput} value={sinLineas && f.origen === "linea" ? "propio" : f.origen} onChange={set("origen")}>
          <option value="propio">Recurso propio</option>
          {!sinLineas ? <option value="linea">De una línea de crédito (avío)</option> : null}
        </select>
      </Campo>
      {f.origen === "linea" ? (
        <Campo label="¿Cuál línea?">
          {sinLineas ? (
            <div style={{ fontSize: 12, color: C.barrial, padding: "8px 0" }}>No hay líneas registradas.</div>
          ) : (
            <select style={estiloInput} value={f.creditoId} onChange={set("creditoId")}>
              <option value="">— Elige línea —</option>
              {creditos.map(c => <option key={c.id} value={c.id}>{c.tipoCredito} · {c.fuente}</option>)}
            </select>
          )}
        </Campo>
      ) : (
        <Campo label="Observación"><input style={estiloInput} placeholder="Ej. Rentas + maquilas sem. 16-22 nov" value={f.observacion} onChange={set("observacion")} /></Campo>
      )}
      {f.origen === "linea" && (
        <Campo label="Observación"><input style={estiloInput} placeholder="Ej. Rentas + maquilas sem. 16-22 nov" value={f.observacion} onChange={set("observacion")} /></Campo>
      )}
      <div className="flex items-end">
        <Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Registrar dispersión"}</Boton>
      </div>
    </div>
  );
}

/* ---------- Préstamos en efectivo ---------- */
function FormPrestamo({ inicial, productores, creditos, onGuardar }) {
  const [f, set] = useForm({
    productorId: inicial?.productorId || (productores[0] ? productores[0].id : ""),
    fecha: inicial?.fecha || hoyStr,
    monto: inicial?.monto ?? "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
    nota: inicial?.nota || "",
  });
  const sinLineas = !creditos || creditos.length === 0;
  const bloqueado = !f.productorId || !f.monto || (f.origen === "linea" && !f.creditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Productor (código de cliente)">
        <select style={estiloInput} value={f.productorId} onChange={set("productorId")}>
          {productores.map(pr => <option key={pr.id} value={pr.id}>{pr.codigo} · {pr.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Fecha del préstamo"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Monto prestado (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 120000" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿De dónde sale el dinero?">
        <select style={estiloInput} value={sinLineas && f.origen === "linea" ? "propio" : f.origen} onChange={set("origen")}>
          <option value="propio">Recurso propio</option>
          {!sinLineas ? <option value="linea">De una línea de crédito (devenga interés)</option> : null}
        </select>
      </Campo>
      {f.origen === "linea" && (
        <Campo label="¿Cuál línea?">
          {sinLineas ? (
            <div style={{ fontSize: 12, color: C.barrial, padding: "8px 0" }}>No hay líneas registradas.</div>
          ) : (
            <select style={estiloInput} value={f.creditoId} onChange={set("creditoId")}>
              <option value="">— Elige línea —</option>
              {creditos.map(c => <option key={c.id} value={c.id}>{c.tipoCredito} · {c.fuente}</option>)}
            </select>
          )}
        </Campo>
      )}
      <Campo label="Nota (opcional)"><input style={estiloInput} placeholder="Ej. Efectivo para gastos de temporada" value={f.nota} onChange={set("nota")} /></Campo>
      <div className="flex items-end">
        <Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Registrar préstamo"}</Boton>
      </div>
    </div>
  );
}

function PrestamoCard({ pp, productor, linea, parcelas, sinLiquidar, puedeEditar, onEditar, onEliminar, onLiquidar, onAplicar, onEliminarAplicacion }) {
  const [aplicando, setAplicando] = useState(false);
  const [f, set] = useForm({ fecha: hoyStr, concepto: "", monto: "", tipo: "productivo", destino: "prorrateo", parcelaId: parcelas[0]?.id || "" });
  const aps = pp.aplicaciones || [];
  const aplicado = aps.reduce((s, a) => s + a.monto, 0);
  const saldo = Math.max(0, pp.monto - aplicado);
  const productivo = aps.filter(a => a.tipo === "productivo").reduce((s, a) => s + a.monto, 0);
  const personal = aps.filter(a => a.tipo === "personal").reduce((s, a) => s + a.monto, 0);
  const interes = pp.origen === "linea" && linea
    ? pp.monto * (tasaCredito(linea) / 100 / 365) * diasEntre(pp.fecha, pp.fechaPago || hoyStr)
    : 0;
  const montoNum = Number(f.monto) || 0;
  const excede = montoNum > saldo;
  const bloqueado = !f.concepto.trim() || !montoNum || excede;
  const guardar = () => {
    if (bloqueado) return;
    onAplicar(f);
    set("concepto")({ target: { value: "" } });
    set("monto")({ target: { value: "" } });
    setAplicando(false);
  };
  return (
    <Tarjeta style={{ padding: 18, borderTop: `3px solid ${C.barrial}` }}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>
              {productor ? `${productor.codigo} · ${productor.nombre}` : "Productor"}
            </span>
            {pp.origen === "linea"
              ? <span style={{ background: "#FBF4E3", color: C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>De línea{linea ? ` · ${linea.fuente}` : ""}</span>
              : <span style={{ background: "#E8F1E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Recurso propio</span>}
            {pp.fechaPago && <span style={{ background: "#E8F1E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Liquidado {pp.fechaPago}</span>}
            {sinLiquidar && <span style={{ background: "#FBF4E3", color: C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>● Disposición sin liquidar</span>}
          </div>
          <div style={{ fontSize: 12, color: C.gris }}>{pp.fecha}{pp.nota ? ` · ${pp.nota}` : ""}</div>
        </div>
        {puedeEditar && <Acciones onEditar={onEditar} onEliminar={onEliminar} />}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3" style={{ fontSize: 13 }}>
        <Fila l="Monto prestado" v={money(pp.monto)} />
        <Fila l="Aplicado" v={money(aplicado)} />
        <Fila l="Sin aplicar" v={money(saldo)} resalta={saldo > 0} />
        {interes > 0 && <Fila l={`Interés (${num(tasaCredito(linea), 2)}% desde ${pp.fecha})`} v={money(interes)} resalta />}
        <Fila l="Productivo (cuenta al cultivo)" v={money(productivo)} />
        <Fila l="Personal (riesgo de cobranza)" v={money(personal)} resalta={personal > 0} />
      </div>

      {aps.length > 0 && (
        <div className="flex flex-col mt-3" style={{ borderTop: `1px solid ${C.linea}` }}>
          {aps.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(a => {
            const p = a.parcelaId ? parcelas.find(x => x.id === a.parcelaId) : null;
            return (
              <div key={a.id} className="flex justify-between items-center gap-2 py-2 flex-wrap" style={{ borderBottom: `1px dashed ${C.linea}`, fontSize: 12.5 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{a.concepto}</span>
                  <span style={{ background: a.tipo === "productivo" ? "#EEF4EB" : "#FBF4E3", color: a.tipo === "productivo" ? C.bosque : C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, marginLeft: 6 }}>
                    {a.tipo === "productivo" ? "Productivo" : "Personal"}
                  </span>
                  <div style={{ fontSize: 11, color: C.gris }}>
                    {a.fecha}{a.tipo === "productivo" ? (a.destino === "parcela" ? ` · a ${p ? p.nombre : "parcela"}` : " · prorrateado por ha") : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span style={{ fontWeight: 700 }}>{money(a.monto)}</span>
                  {puedeEditar && (
                    <button onClick={() => onEliminarAplicacion(a.id)} title="Eliminar aplicación" aria-label="Eliminar aplicación"
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris, padding: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {puedeEditar && !aplicando && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <Boton chico secundario deshabilitado={saldo <= 0} onClick={() => setAplicando(true)}><Plus size={13} /> Aplicar dinero</Boton>
          {pp.origen === "linea" && !pp.fechaPago && <Boton chico secundario onClick={onLiquidar}><CheckCircle2 size={13} /> Marcar liquidado</Boton>}
        </div>
      )}
      {puedeEditar && aplicando && (
        <div className="mt-3 p-3" style={{ background: C.papel, borderRadius: 10 }}>
          <div className="flex justify-between items-center mb-2">
            <span style={{ fontSize: 13, fontWeight: 700 }}>¿En qué se aplicó? · disponible {money(saldo)}</span>
            <button onClick={() => setAplicando(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={15} /></button>
          </div>
          <div className="grid md:grid-cols-3 gap-2">
            <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
            <Campo label="Concepto"><input style={estiloInput} placeholder="Ej. Rayas de deshierbe" value={f.concepto} onChange={set("concepto")} /></Campo>
            <Campo label="Monto (MXN)"><input type="number" style={{ ...estiloInput, borderColor: excede ? C.rojo : C.linea }} placeholder="0" value={f.monto} onChange={set("monto")} /></Campo>
            <Campo label="Tipo">
              <select style={estiloInput} value={f.tipo} onChange={set("tipo")}>
                <option value="productivo">Productivo · cuenta al costo del cultivo</option>
                <option value="personal">Personal · solo cuenta del productor</option>
              </select>
            </Campo>
            {f.tipo === "productivo" && (
              <Campo label="¿Cómo se reparte?">
                <select style={estiloInput} value={f.destino} onChange={set("destino")}>
                  <option value="prorrateo">Prorratear por hectárea</option>
                  <option value="parcela">A una parcela específica</option>
                </select>
              </Campo>
            )}
            {f.tipo === "productivo" && f.destino === "parcela" && (
              <Campo label="Parcela">
                <select style={estiloInput} value={f.parcelaId} onChange={set("parcelaId")}>
                  {parcelas.map(p => <option key={p.id} value={p.id}>{p.cultivo} · {p.nombre}</option>)}
                </select>
              </Campo>
            )}
          </div>
          {excede && (
            <div className="flex items-center gap-2 mt-2" style={{ fontSize: 12, color: C.rojo, fontWeight: 600 }}>
              <AlertTriangle size={14} /> El monto excede lo disponible del préstamo ({money(saldo)}).
            </div>
          )}
          <div className="mt-2"><Boton chico deshabilitado={bloqueado} onClick={guardar}>Guardar aplicación</Boton></div>
        </div>
      )}
    </Tarjeta>
  );
}









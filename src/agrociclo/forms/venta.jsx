// @ts-nocheck
/* Raya (jornales por cuadrilla) y cosecha (boletas de bodega). */
import { C, money, num, hoyStr, calcBoleta } from "../base";
import { estiloInput, Boton, Campo, PickerParcela, useForm } from "../ui";

export function FormNomina({ inicial, parcelas, directorio, onGuardar }) {
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

export function FormBoleta({ inicial, parcelas, onGuardar, veFinanzas = true }) {
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

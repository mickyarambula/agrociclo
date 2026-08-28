// @ts-nocheck
import { fuente } from "../ui";
import { Simulador, Reportes } from "../reportes";

export function VistaReportes({ vista, veFinanzas, parcelasT, costosParcela, inversionTotal, ingresoTotal, laboresHechas, nominaT, insumos, gastosT, apsProductivas, prestamosT, productores, costoFinTotal, costoDirectoTotal, gastosIndTotal, ingresoRealTotal, rentaTotal, haTotal, dieselUsado, dieselCosto }) {
  return (
    <>
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
    </>
  );
}

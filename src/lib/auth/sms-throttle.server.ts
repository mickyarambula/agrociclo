import { getSql } from "../db";
import { ThrottleSmsError } from "./sms-throttle-pure";

/**
 * Candado anti-quema de saldo para el envío de códigos por SMS. Un renglón
 * por intento en `agrociclo_sms_envio` (migración 0008); revisa por teléfono
 * y por IP antes de dejar mandar el siguiente.
 */

const VENTANA_REENVIO_SEG = 60;
const MAX_POR_TELEFONO_DIA = 5;
const MAX_POR_IP_HORA = 10;

export async function verificarThrottleSms(telefono: string, ip: string): Promise<void> {
  const sql = await getSql();

  const [ultimo] = await sql.query<{ segundos: number }>(
    `select extract(epoch from (now() - enviado_en))::int as segundos
     from agrociclo_sms_envio
     where telefono = $1
     order by enviado_en desc
     limit 1`,
    [telefono],
  );
  if (ultimo && ultimo.segundos < VENTANA_REENVIO_SEG) {
    throw new ThrottleSmsError(
      "Espera un poco antes de pedir otro código.",
      VENTANA_REENVIO_SEG - ultimo.segundos,
    );
  }

  const [porTelefono] = await sql.query<{ n: number }>(
    `select count(*)::int as n from agrociclo_sms_envio
     where telefono = $1 and enviado_en > now() - interval '1 day'`,
    [telefono],
  );
  if ((porTelefono?.n ?? 0) >= MAX_POR_TELEFONO_DIA) {
    throw new ThrottleSmsError("Ya se pidieron muchos códigos a este número hoy. Intenta más tarde.");
  }

  const [porIp] = await sql.query<{ n: number }>(
    `select count(*)::int as n from agrociclo_sms_envio
     where ip = $1 and enviado_en > now() - interval '1 hour'`,
    [ip],
  );
  if ((porIp?.n ?? 0) >= MAX_POR_IP_HORA) {
    throw new ThrottleSmsError("Demasiados intentos desde este lugar. Intenta más tarde.");
  }

  await sql.query(`insert into agrociclo_sms_envio (telefono, ip) values ($1, $2)`, [telefono, ip]);
}

export { ThrottleSmsError, ipDeSolicitud } from "./sms-throttle-pure";

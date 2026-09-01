/**
 * Envío de SMS, desacoplado del proveedor. Hoy es Twilio; si mañana se cambia
 * a WhatsApp u otro proveedor, solo se toca este archivo — nadie más importa
 * Twilio directamente.
 */

export interface EnviarSmsInput {
  telefono: string; // formato E.164, ej. +526681234567
  mensaje: string;
}

export type EnviarSms = (input: EnviarSmsInput) => Promise<void>;

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_FROM;

async function enviarConTwilio({ telefono, mensaje }: EnviarSmsInput): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
  const body = new URLSearchParams({ To: telefono, From: twilioFrom!, Body: mensaje });
  const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`No se pudo enviar el SMS (Twilio ${res.status}): ${detalle}`);
  }
}

async function enviarPorConsola({ telefono, mensaje }: EnviarSmsInput): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[sms-consola] a ${telefono}: ${mensaje}`);
}

const twilioConfigurado = Boolean(twilioSid && twilioToken && twilioFrom);

/**
 * En producción sin credenciales de Twilio, truena en vez de fingir que envió
 * el código — nada falla en silencio.
 */
export const enviarSms: EnviarSms = twilioConfigurado
  ? enviarConTwilio
  : process.env.NODE_ENV === "production"
    ? async () => {
        throw new Error(
          "Faltan las credenciales de Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM) en producción.",
        );
      }
    : enviarPorConsola;

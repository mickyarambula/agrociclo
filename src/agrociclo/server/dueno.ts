/**
 * Quién es Dueño: solo cuentas que todavía existen en Better Auth (`"user"`).
 * Un renglón huérfano en usuario_rol no bloquea al siguiente que entre.
 */

export function rolDeEntrada(dueñosVivos: number): "Dueño" | "pendiente" {
  return dueñosVivos > 0 ? "pendiente" : "Dueño";
}

/** Si el Dueño desapareció (cuenta borrada), quien abra sesión toma el rancho. */
export function debePromoverADueño(rolActual: string, dueñosVivos: number): boolean {
  return rolActual !== "Dueño" && dueñosVivos === 0;
}

export function etiquetaDueño(row: { display_name: string | null; email: string | null } | null | undefined): string | null {
  if (!row) return null;
  const nombre = (row.display_name || "").trim();
  const email = (row.email || "").trim();
  if (nombre && email) return `${nombre} · ${email}`;
  return nombre || email || null;
}

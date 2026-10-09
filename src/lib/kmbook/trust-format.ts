/**
 * KMBOOK Staff — Semáforo de clientas y depósitos (sólo lectura).
 *
 * Funciones PURAS (sin acceso a datos). Core calcula el color, el porcentaje y los importes;
 * Staff sólo normaliza la respuesta de los RPC y la convierte en texto accesible.
 * Contrato: docs/contracts/trust-deposits.md de KMBOOK Core.
 * Privacidad: nada de lo que se normaliza aquí debe ir a logs, push ni service worker.
 */

export type TrustColor = "green" | "yellow" | "red";

export const TRUST_VIEW_CAPABILITY = "trust.view";

/** Máximo de clientas por llamada a get_studio_clients_trust (límite de Core). */
export const TRUST_CLIENTS_BATCH_LIMIT = 500;

const TRUST_LABELS: Record<TrustColor, string> = {
  green: "Clienta verde",
  yellow: "Clienta amarilla",
  red: "Clienta roja",
};

export function normalizeTrustColor(value: unknown): TrustColor | null {
  return value === "green" || value === "yellow" || value === "red" ? value : null;
}

/** Texto accesible: nunca sólo color. */
export function trustLabel(color: TrustColor): string {
  return TRUST_LABELS[color];
}

export type AppointmentDeposit = {
  hasTerms: boolean;
  trustColor: TrustColor | null;
  currency: string;
  total: number;
  required: number;
  paid: number;
  waived: boolean;
  waivedAmount: number;
  waivedReason: string | null;
  satisfied: boolean;
  depositPending: number;
  balanceDue: number;
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normaliza el jsonb de get_studio_appointment_deposit. Devuelve null si la forma no es la esperada
 * (la pantalla degrada a «sin indicador»).
 */
export function parseAppointmentDeposit(raw: unknown): AppointmentDeposit | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.has_terms !== "boolean") return null;

  const reason = typeof r.waived_reason === "string" && r.waived_reason.trim() ? r.waived_reason.trim() : null;
  return {
    hasTerms: r.has_terms,
    trustColor: normalizeTrustColor(r.trust_color),
    currency: typeof r.currency === "string" && /^[A-Za-z]{3}$/.test(r.currency) ? r.currency.toUpperCase() : "EUR",
    total: num(r.total),
    required: num(r.required),
    paid: num(r.paid),
    waived: r.waived === true,
    waivedAmount: num(r.waived_amount),
    waivedReason: reason,
    satisfied: r.satisfied === true,
    depositPending: num(r.deposit_pending),
    balanceDue: num(r.balance_due),
  };
}

export type ClientTrustRow = { clientId: string; color: TrustColor };

/** Normaliza las filas de get_studio_clients_trust (descarta las que no tengan color válido). */
export function parseClientsTrust(raw: unknown): ClientTrustRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: ClientTrustRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const color = normalizeTrustColor(r.color);
    if (typeof r.client_id === "string" && color) rows.push({ clientId: r.client_id, color });
  }
  return rows;
}

/** Divide una lista en lotes de como máximo `size` elementos, sin duplicados ni vacíos. */
export function chunkClientIds(ids: ReadonlyArray<string | null | undefined>, size = TRUST_CLIENTS_BATCH_LIMIT): string[][] {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size));
  return out;
}

export function formatMoney(amount: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** El depósito está exigido y sin cubrir: no se puede confirmar. */
export function isDepositPending(d: AppointmentDeposit | null | undefined): boolean {
  return !!d && d.hasTerms && !d.satisfied;
}

export function depositPendingNotice(d: AppointmentDeposit): string {
  return `Depósito pendiente: ${formatMoney(d.depositPending, d.currency)}`;
}

export type DepositLine = { label: string; value: string };

/** Líneas del detalle: exigido, cobrado, pendiente de depósito, saldo pendiente. */
export function depositLines(d: AppointmentDeposit): DepositLine[] {
  return [
    { label: "Depósito exigido", value: formatMoney(d.required, d.currency) },
    { label: "Cobrado", value: formatMoney(d.paid, d.currency) },
    { label: "Pendiente de depósito", value: formatMoney(d.depositPending, d.currency) },
    { label: "Saldo pendiente", value: formatMoney(d.balanceDue, d.currency) },
  ];
}

export const DEPOSIT_WAIVED_TEXT = "Depósito omitido por excepción autorizada";

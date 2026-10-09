/**
 * KMBOOK Staff — Lista de espera inteligente.
 *
 * Funciones PURAS (sin acceso a datos). Core decide quién puede operar, qué huecos son compatibles, si hay
 * oferta vigente, el semáforo y el depósito; Staff sólo normaliza las respuestas de los RPC y las convierte
 * en texto. Ninguna regla de negocio se reimplementa aquí.
 * Contrato: docs/contracts/waitlist.md de KMBOOK Core.
 */

import { normalizeTrustColor, type TrustColor } from "./trust-format";

export type WaitlistStatus = "active" | "contacted" | "booked" | "removed";
export type WaitlistSource = "staff" | "online";

export const WAITLIST_STATUSES: readonly WaitlistStatus[] = ["active", "contacted", "booked", "removed"];

/** Estados que Staff puede fijar a mano con update_waitlist_entry. `booked` lo decide Core. */
export const SETTABLE_STATUSES = ["active", "contacted", "removed"] as const;
export type SettableStatus = (typeof SETTABLE_STATUSES)[number];

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  active: "En cola",
  contacted: "Contactada",
  booked: "Reservada",
  removed: "Retirada",
};

export function waitlistStatusLabel(status: WaitlistStatus): string {
  return STATUS_LABELS[status];
}

export function normalizeWaitlistStatus(value: unknown): WaitlistStatus | null {
  return value === "active" || value === "contacted" || value === "booked" || value === "removed" ? value : null;
}

export function sourceLabel(source: WaitlistSource): string {
  return source === "online" ? "Online" : "Recepción";
}

export function offerOriginLabel(origin: string | null): string {
  return origin === "auto" ? "Oferta automática" : "Oferta de recepción";
}

// ---------------------------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------------------------

export type WaitlistFilter = "all" | WaitlistStatus;

export const WAITLIST_FILTERS: ReadonlyArray<{ value: WaitlistFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "active", label: "En cola" },
  { value: "contacted", label: "Contactadas" },
  { value: "booked", label: "Reservadas" },
  { value: "removed", label: "Retiradas" },
];

export function parseFilter(raw: unknown): WaitlistFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && (WAITLIST_FILTERS.some((f) => f.value === value)) ? (value as WaitlistFilter) : "all";
}

/** Parámetro p_status de get_waitlist_board: null = todas. */
export function filterToRpcStatus(filter: WaitlistFilter): WaitlistStatus | null {
  return filter === "all" ? null : filter;
}

// ---------------------------------------------------------------------------------------------
// Días y franja
// ---------------------------------------------------------------------------------------------

/** 0 = domingo (como Core). Se muestran de lunes a domingo. */
export const WEEKDAYS: ReadonlyArray<{ value: number; short: string; long: string }> = [
  { value: 1, short: "L", long: "Lunes" },
  { value: 2, short: "M", long: "Martes" },
  { value: 3, short: "X", long: "Miércoles" },
  { value: 4, short: "J", long: "Jueves" },
  { value: 5, short: "V", long: "Viernes" },
  { value: 6, short: "S", long: "Sábado" },
  { value: 0, short: "D", long: "Domingo" },
];

export function normalizeDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const days = raw.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6);
  return Array.from(new Set(days));
}

export function daysLabel(days: ReadonlyArray<number>): string {
  if (days.length === 0 || days.length === 7) return "Cualquier día";
  const set = new Set(days);
  return WEEKDAYS.filter((d) => set.has(d.value))
    .map((d) => d.long.slice(0, 3))
    .join(", ");
}

/** "09:00:00" -> "09:00". Vacío / inválido -> null. */
export function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{2}):(\d{2})(?::\d{2})?/.exec(raw);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function timeRangeLabel(from: string | null, to: string | null): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `Desde ${from}`;
  if (to) return `Hasta ${to}`;
  return "Cualquier hora";
}

// ---------------------------------------------------------------------------------------------
// Tablero (get_waitlist_board)
// ---------------------------------------------------------------------------------------------

export type WaitlistOffer = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  professionalId: string | null;
  professionalName: string | null;
  origin: string | null;
};

export type WaitlistAppointment = { id: string; status: string; startsAt: string | null };

export type WaitlistEntry = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  serviceId: string;
  serviceName: string;
  serviceDuration: number | null;
  servicePrice: number | null;
  currency: string;
  preferredProfessionalId: string | null;
  preferredProfessionalName: string | null;
  preferredDays: number[];
  timeFrom: string | null;
  timeTo: string | null;
  status: WaitlistStatus;
  source: WaitlistSource;
  notes: string | null;
  createdAt: string;
  /** Posición en la cola (sólo entradas activas). */
  position: number | null;
  /** Sólo si Core lo devuelve (trust.view + semáforo activo). Nunca se deduce. */
  trustColor: TrustColor | null;
  depositPercent: number | null;
  offer: WaitlistOffer | null;
  appointment: WaitlistAppointment | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function parseOffer(raw: unknown): WaitlistOffer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const startsAt = str(r.starts_at);
  const endsAt = str(r.ends_at);
  const expiresAt = str(r.expires_at);
  if (!id || !startsAt || !endsAt || !expiresAt) return null;
  return {
    id,
    status: str(r.status) ?? "pending",
    startsAt,
    endsAt,
    expiresAt,
    professionalId: str(r.professional_id),
    professionalName: str(r.professional_name),
    origin: str(r.origin),
  };
}

function parseAppointmentRef(raw: unknown): WaitlistAppointment | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  return { id, status: str(r.status) ?? "pending", startsAt: str(r.starts_at) };
}

export function parseWaitlistEntry(raw: unknown): WaitlistEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const clientId = str(r.client_id);
  const serviceId = str(r.service_id);
  const status = normalizeWaitlistStatus(r.status);
  if (!id || !clientId || !serviceId || !status) return null;
  const currency = typeof r.currency === "string" && /^[A-Za-z]{3}$/.test(r.currency) ? r.currency.toUpperCase() : "EUR";
  return {
    id,
    clientId,
    clientName: str(r.client_name) ?? "Clienta",
    clientPhone: str(r.client_phone),
    serviceId,
    serviceName: str(r.service_name) ?? "Servicio",
    serviceDuration: numOrNull(r.service_duration),
    servicePrice: numOrNull(r.service_price),
    currency,
    preferredProfessionalId: str(r.preferred_professional_id),
    preferredProfessionalName: str(r.preferred_professional_name),
    preferredDays: normalizeDays(r.preferred_days),
    timeFrom: normalizeTime(r.preferred_time_from),
    timeTo: normalizeTime(r.preferred_time_to),
    status,
    source: r.source === "online" ? "online" : "staff",
    notes: str(r.notes),
    createdAt: str(r.created_at) ?? "",
    position: status === "active" ? numOrNull(r.position) : null,
    // El color sólo existe si Core lo envía; cualquier valor no válido se descarta.
    trustColor: normalizeTrustColor(r.trust_color),
    depositPercent: numOrNull(r.deposit_percent),
    offer: parseOffer(r.offer),
    appointment: parseAppointmentRef(r.appointment),
  };
}

/** Normaliza el jsonb[] de get_waitlist_board. Filas inválidas se descartan. */
export function parseWaitlistBoard(raw: unknown): WaitlistEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: WaitlistEntry[] = [];
  for (const item of raw) {
    const e = parseWaitlistEntry(item);
    if (e) out.push(e);
  }
  return out;
}

/** Entradas que siguen esperando hueco (para el contador de la agenda). */
export function countActive(entries: ReadonlyArray<WaitlistEntry>): number {
  return entries.filter((e) => e.status === "active").length;
}

// ---------------------------------------------------------------------------------------------
// Cuenta atrás de la oferta
// ---------------------------------------------------------------------------------------------

/** Milisegundos hasta `expiresAt` (≥ 0). NaN si la fecha no es válida. */
export function msUntil(expiresAtIso: string, now: number): number {
  const t = Date.parse(expiresAtIso);
  if (Number.isNaN(t)) return Number.NaN;
  return Math.max(0, t - now);
}

/** «Caduca en 2 h 05 min», «Caduca en 12 min», «Caducada». */
export function countdownLabel(expiresAtIso: string, now: number): string {
  const ms = msUntil(expiresAtIso, now);
  if (Number.isNaN(ms)) return "Caducidad desconocida";
  if (ms <= 0) return "Caducada";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `Caduca en ${d} ${d === 1 ? "día" : "días"}`;
  }
  if (h > 0) return `Caduca en ${h} h ${String(m).padStart(2, "0")} min`;
  return `Caduca en ${totalMin} min`;
}

// ---------------------------------------------------------------------------------------------
// Huecos compatibles (get_waitlist_compatible_slots)
// ---------------------------------------------------------------------------------------------

export type CompatibleSlot = {
  date: string;
  time: string;
  startsAt: string;
  endsAt: string;
  professionalId: string;
  professionalName: string;
};

export function parseCompatibleSlots(raw: unknown): CompatibleSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: CompatibleSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const date = str(r.slot_date);
    const startsAt = str(r.slot_start);
    const endsAt = str(r.slot_end);
    const professionalId = str(r.professional_id);
    const time = normalizeTime(r.slot_time);
    if (!date || !startsAt || !endsAt || !professionalId || !time) continue;
    out.push({ date, time, startsAt, endsAt, professionalId, professionalName: str(r.professional_name) ?? "Profesional" });
  }
  return out;
}

export type SlotGroup = {
  date: string;
  professionals: Array<{ professionalId: string; professionalName: string; slots: CompatibleSlot[] }>;
};

/** Agrupa por día y profesional conservando el orden cronológico. */
export function groupSlots(slots: ReadonlyArray<CompatibleSlot>): SlotGroup[] {
  const sorted = [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days = new Map<string, SlotGroup>();
  for (const s of sorted) {
    let day = days.get(s.date);
    if (!day) {
      day = { date: s.date, professionals: [] };
      days.set(s.date, day);
    }
    let pro = day.professionals.find((p) => p.professionalId === s.professionalId);
    if (!pro) {
      pro = { professionalId: s.professionalId, professionalName: s.professionalName, slots: [] };
      day.professionals.push(pro);
    }
    pro.slots.push(s);
  }
  return Array.from(days.values());
}

/** Fecha `YYYY-MM-DD` + n días (calendario, sin zona horaria). */
export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export const SLOT_WINDOW_DAYS = 14;

export function formatDayHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------------------------
// Depósito al convertir
// ---------------------------------------------------------------------------------------------

/**
 * Métodos que Core acepta para registrar un cobro en recepción (studio_validate_deposit_origin).
 * `card_online` es el cobro online de Client: no se ofrece en Staff.
 */
export const DEPOSIT_METHODS = [
  { value: "cash", label: "Efectivo", needsProvider: false },
  { value: "card_terminal", label: "Tarjeta (TPV)", needsProvider: false },
  { value: "bank_transfer", label: "Transferencia", needsProvider: false },
  { value: "bizum", label: "Bizum", needsProvider: false },
  { value: "other", label: "Otro", needsProvider: true },
] as const;

export type DepositMethod = (typeof DEPOSIT_METHODS)[number]["value"];

export function isDepositMethod(value: unknown): value is DepositMethod {
  return DEPOSIT_METHODS.some((m) => m.value === value);
}

export const PROVIDER_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
export const WAIVE_REASON_MIN = 5;
export const WAIVE_REASON_MAX = 500;

export type DepositQuote = {
  enabled: boolean;
  total: number;
  currency: string;
  depositPercent: number;
  required: number;
  /** Sólo con trust.view y semáforo activo. */
  color: TrustColor | null;
  canWaive: boolean;
  canRecord: boolean;
};

/** Normaliza studio_quote_appointment_deposit. null si la forma no es la esperada. */
export function parseDepositQuote(raw: unknown): DepositQuote | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.enabled !== "boolean") return null;
  return {
    enabled: r.enabled,
    total: numOrNull(r.total) ?? 0,
    currency: typeof r.currency === "string" && /^[A-Za-z]{3}$/.test(r.currency) ? r.currency.toUpperCase() : "EUR",
    depositPercent: numOrNull(r.deposit_percent) ?? 0,
    required: numOrNull(r.required) ?? 0,
    color: normalizeTrustColor(r.color),
    canWaive: r.can_waive === true,
    canRecord: r.can_record === true,
  };
}

export type BookInput = {
  depositAmount: number | null;
  method: string | null;
  provider: string | null;
  reference: string | null;
  waive: boolean;
  waiveReason: string | null;
};

export type BookValidation = { ok: true } | { ok: false; field: "amount" | "method" | "provider" | "waive" | "reason"; message: string };

/**
 * Validación previa (UX) del formulario de reserva. NO sustituye a Core: sólo evita viajes inútiles.
 * `canWaive` viene de Core (quote). Si Core no lo ha indicado, omitir el depósito no está permitido.
 */
export function validateBookInput(input: BookInput, ctx: { canWaive: boolean }): BookValidation {
  if (input.waive) {
    if (!ctx.canWaive) {
      return { ok: false, field: "waive", message: "No puedes omitir el depósito en esta reserva." };
    }
    const reason = (input.waiveReason ?? "").trim();
    if (reason.length < WAIVE_REASON_MIN) {
      return { ok: false, field: "reason", message: `Indica el motivo (mínimo ${WAIVE_REASON_MIN} caracteres).` };
    }
    if (reason.length > WAIVE_REASON_MAX) {
      return { ok: false, field: "reason", message: `El motivo no puede superar ${WAIVE_REASON_MAX} caracteres.` };
    }
    if (input.depositAmount !== null && input.depositAmount > 0) {
      return { ok: false, field: "waive", message: "Para omitir el depósito no registres ningún cobro." };
    }
    return { ok: true };
  }

  const amount = input.depositAmount;
  if (amount === null || amount === 0) return { ok: true }; // la cita queda pendiente
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, field: "amount", message: "Importe no válido." };
  }
  if (!isDepositMethod(input.method)) {
    return { ok: false, field: "method", message: "Elige cómo se ha cobrado el depósito." };
  }
  const method = DEPOSIT_METHODS.find((m) => m.value === input.method);
  if (method?.needsProvider && !(input.provider && PROVIDER_PATTERN.test(input.provider))) {
    return { ok: false, field: "provider", message: "Indica el medio de pago (letras minúsculas, números y _)." };
  }
  if (input.provider && !PROVIDER_PATTERN.test(input.provider)) {
    return { ok: false, field: "provider", message: "Medio de pago no válido (letras minúsculas, números y _)." };
  }
  return { ok: true };
}

/** Parámetros del RPC book_waitlist_entry derivados del formulario (sin reglas: Core decide). */
export function buildBookRpcArgs(input: BookInput, idempotencyKey: string) {
  const paying = !input.waive && input.depositAmount !== null && input.depositAmount > 0;
  const method = DEPOSIT_METHODS.find((m) => m.value === input.method);
  const provider = paying && method?.needsProvider ? (input.provider?.trim() || null) : null;
  return {
    p_deposit_amount: paying ? input.depositAmount : null,
    p_deposit_method: paying ? input.method : null,
    p_deposit_provider: provider,
    p_deposit_reference: paying ? input.reference?.trim() || null : null,
    p_waive: input.waive,
    p_waive_reason: input.waive ? (input.waiveReason ?? "").trim() : null,
    p_idempotency_key: idempotencyKey,
  };
}

/** Clave de idempotencia (8..200 caracteres, como exige Core). Una por formulario/intento. */
export function newIdempotencyKey(prefix = "wl-book"): string {
  const rand =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${rand}`;
}

export type BookOutcome = {
  appointmentId: string;
  /** Estado de la cita: pending hasta cubrir el depósito. */
  appointmentStatus: string;
  entryStatus: string | null;
  replayed: boolean;
  depositPending: number;
  currency: string;
  satisfied: boolean;
};

export function parseBookResult(raw: unknown): BookOutcome | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const appointmentId = str(r.appointment_id);
  if (!appointmentId) return null;
  return {
    appointmentId,
    appointmentStatus: str(r.status) ?? "pending",
    entryStatus: str(r.entry_status),
    replayed: r.replayed === true,
    depositPending: numOrNull(r.deposit_pending) ?? 0,
    currency: typeof r.currency === "string" && /^[A-Za-z]{3}$/.test(r.currency) ? r.currency.toUpperCase() : "EUR",
    satisfied: r.satisfied === true,
  };
}

export const BOOK_PENDING_TEXT = "La reserva no se confirma hasta cubrir el depósito.";

/** Mensaje de éxito tras convertir. Una cita `pending` jamás se presenta como confirmada. */
export function bookOutcomeMessage(o: BookOutcome): string {
  if (o.appointmentStatus === "pending") {
    return `Reserva creada y pendiente de depósito. ${BOOK_PENDING_TEXT}`;
  }
  return "Reserva creada y confirmada.";
}

// ---------------------------------------------------------------------------------------------
// Formulario de alta / edición
// ---------------------------------------------------------------------------------------------

export const NOTES_MAX = 500;

export type PreferencesInput = {
  days: number[];
  timeFrom: string | null;
  timeTo: string | null;
  notes: string | null;
};

export function validatePreferences(p: PreferencesInput): { ok: true } | { ok: false; message: string } {
  if (p.timeFrom && p.timeTo && p.timeFrom >= p.timeTo) {
    return { ok: false, message: "La hora «desde» debe ser anterior a «hasta»." };
  }
  if (p.notes && p.notes.length > NOTES_MAX) {
    return { ok: false, message: `Las notas no pueden superar ${NOTES_MAX} caracteres.` };
  }
  return { ok: true };
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------------------------
// Acceso a la sección
// ---------------------------------------------------------------------------------------------

export type BoardAccess = "ok" | "forbidden" | "unavailable";

/**
 * Clasifica el error de get_waitlist_board. `authorization_required` = la usuaria no tiene
 * `waitlist.operate`: la sección se oculta («No tienes acceso»). RPC ausente (entorno sin la migración)
 * o cualquier otro fallo = no disponible, sin romper la app.
 */
export function classifyBoardError(error: unknown): Exclude<BoardAccess, "ok"> {
  const message =
    typeof error === "object" && error !== null && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  if (message.includes("authorization_required")) return "forbidden";
  return "unavailable";
}

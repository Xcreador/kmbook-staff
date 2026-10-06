import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AttendanceStatus, AttendanceAction } from "@/types/database";

export type TimeClockState = "SIN_INICIAR" | "TRABAJANDO" | "EN_PAUSA" | "FINALIZADO";

export type TimeClockAction = "ENTRAR" | "INICIAR_PAUSA" | "REANUDAR" | "SALIR";

export type TimeClockShift = {
  id: string;
  organizationId: string;
  userId: string;
  locationId: string | null;
  date: string;
  state: TimeClockState;
  clockInTime: string | null; // ISO
  clockOutTime: string | null; // ISO
  totalWorkedSeconds: number;
  totalBreakSeconds: number;
  currentBreakStartedAt: string | null;
  plannedStart: string; // "09:00"
  plannedEnd: string; // "17:00"
};

export type ShiftHistoryEntry = {
  id: string;
  date: string;
  formattedDate: string;
  clockIn: string;
  clockOut: string;
  totalWorked: string;
  totalBreaks: string;
  status: AttendanceStatus;
};

export type TimeClockResponse = {
  success: boolean;
  message: string;
  shift?: TimeClockShift;
  /** El fichaje desde este dispositivo ya no está disponible: ocultar acciones. */
  blocked?: boolean;
};

/**
 * Textos para la profesional cuando no puede fichar desde este dispositivo.
 * Lenguaje claro: sin nombres de RPC, ajustes, códigos ni jerga de permisos.
 */
export const TIME_CLOCK_UNAVAILABLE_TITLE = "Fichaje desde este dispositivo no disponible";

export type TimeClockUnavailableReason =
  | "session"
  | "organization"
  | "organization_changed"
  | "disabled"
  | "unavailable";

export function timeClockUnavailableMessage(reason: TimeClockUnavailableReason): string {
  switch (reason) {
    case "session":
      return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
    case "organization":
      return "Elige el salón donde trabajas hoy para continuar.";
    case "organization_changed":
      return "Has cambiado de salón. Vuelve a abrir el fichaje.";
    case "disabled":
      return "Tu salón registra la jornada en el terminal de recepción.";
    case "unavailable":
    default:
      return "Ahora mismo no podemos comprobarlo. Ficha en el terminal de recepción o inténtalo más tarde.";
  }
}

export const ATTENDANCE_ERROR_MAP: Record<string, string> = {
  attendance_already_started: "Ya tienes una jornada iniciada.",
  attendance_not_started: "No hay ninguna jornada iniciada.",
  attendance_already_on_break: "Ya estás en pausa.",
  attendance_not_on_break: "No estás en pausa.",
  idempotency_key_conflict: "Esta acción ya se usó para otro fichaje. Recarga la página.",
  idempotency_key_required: "Recarga la página e inténtalo de nuevo.",
  location_not_found: "Ese centro no pertenece a la organización.",
  member_not_found: "Esa persona no es miembro activo de la organización.",
  authentication_required: "Tu sesión ha caducado. Vuelve a entrar.",
  authorization_required: "Tu perfil de acceso no permite esta acción.",
};

export function getAttendanceErrorMessage(
  message: string | undefined,
  fallback = "No se pudo registrar el fichaje. Inténtalo de nuevo.",
): string {
  if (!message) return fallback;
  for (const [key, translated] of Object.entries(ATTENDANCE_ERROR_MAP)) {
    if (message.includes(key)) {
      return translated;
    }
  }
  return fallback;
}

export const ACTION_TO_CORE_MAP: Record<TimeClockAction, AttendanceAction> = {
  ENTRAR: "start",
  INICIAR_PAUSA: "break_start",
  REANUDAR: "break_end",
  SALIR: "end",
};

/**
 * Mapea el estado de Core a los estados de Staff.
 * La jornada abierta manda; si no hay abierta pero hubo jornada hoy: FINALIZADO.
 */
export function mapSessionToStaffState(
  status: AttendanceStatus | null,
  hasFinishedToday: boolean,
): TimeClockState {
  if (status === "working") return "TRABAJANDO";
  if (status === "on_break") return "EN_PAUSA";
  if (status === "finished") return "FINALIZADO";
  if (hasFinishedToday) return "FINALIZADO";
  return "SIN_INICIAR";
}

/**
 * Calcula segundos totales de pausa y detecta si hay una pausa activa.
 */
export function calculateBreakSeconds(
  breaks: Array<{ started_at: string; ended_at: string | null }>,
  sessionEndIso: string | null,
  nowMs: number = Date.now(),
): { totalBreakSeconds: number; currentBreakStartedAt: string | null } {
  const sessionEnd = sessionEndIso ? new Date(sessionEndIso).getTime() : nowMs;
  let totalBreakSeconds = 0;
  let currentBreakStartedAt: string | null = null;

  for (const b of breaks) {
    const bStart = new Date(b.started_at).getTime();
    if (b.ended_at) {
      const bEnd = new Date(b.ended_at).getTime();
      totalBreakSeconds += Math.max(0, Math.floor((bEnd - bStart) / 1000));
    } else {
      currentBreakStartedAt = b.started_at;
      totalBreakSeconds += Math.max(0, Math.floor((sessionEnd - bStart) / 1000));
    }
  }

  return { totalBreakSeconds, currentBreakStartedAt };
}

/**
 * Calcula segundos trabajados efectivos deduciendo pausas de timestamps reales.
 */
export function calculateWorkedSeconds(
  startedAtIso: string,
  endedAtIso: string | null,
  totalBreakSeconds: number,
  nowMs: number = Date.now(),
): number {
  const startMs = new Date(startedAtIso).getTime();
  const endMs = endedAtIso ? new Date(endedAtIso).getTime() : nowMs;
  const grossSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  return Math.max(0, grossSeconds - totalBreakSeconds);
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours === 0) return `${restMinutes} min`;
  return `${hours} h ${String(restMinutes).padStart(2, "0")} min`;
}

export function formatClockTime(isoString: string | null, timeZone = "Europe/Madrid"): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(new Date(isoString));
  } catch {
    const d = new Date(isoString);
    return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
  }
}

export function formatHistoryDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (dateStr === todayStr) {
      return `Hoy (${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(d)})`;
    }
    if (dateStr === yesterdayStr) {
      return `Ayer (${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(d)})`;
    }
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(d);
  } catch {
    return dateStr;
  }
}

export async function getPlannedShiftForUser(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
  dateStr: string,
): Promise<{ plannedStart: string; plannedEnd: string }> {
  try {
    const { data: prof } = await supabase
      .from("studio_professionals")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!prof) {
      return { plannedStart: "09:00", plannedEnd: "17:00" };
    }

    const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
    const isoWeekday = day === 0 ? 7 : day;

    const { data: hours } = await supabase
      .from("studio_working_hours")
      .select("starts_at, ends_at")
      .eq("organization_id", organizationId)
      .eq("professional_id", prof.id)
      .eq("weekday", isoWeekday)
      .eq("active", true)
      .order("starts_at")
      .limit(1)
      .maybeSingle();

    if (hours) {
      return {
        plannedStart: hours.starts_at.slice(0, 5),
        plannedEnd: hours.ends_at.slice(0, 5),
      };
    }
  } catch {
    // Silently fall back to default shift hours
  }

  return { plannedStart: "09:00", plannedEnd: "17:00" };
}

import { zonedDateString, zonedDayBoundsIso } from "@/lib/kmbook/zoned-time";

export async function fetchTodaySessionFromSupabase(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
  timeZone?: string,
): Promise<TimeClockShift> {
  // «Hoy» = día local de la organización (el servidor corre en UTC).
  const dateStr = zonedDateString(timeZone);
  const { startIso: startOfDayIso, endIso: endOfDayIso } = zonedDayBoundsIso(timeZone, dateStr);

  // 1. Jornada abierta manda (status <> 'finished')
  const { data: openSessions } = await supabase
    .from("studio_attendance_sessions")
    .select("id, organization_id, location_id, user_id, professional_id, started_at, ended_at, status, source, corrected")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .neq("status", "finished")
    .order("started_at", { ascending: false })
    .limit(1);

  const activeSession = openSessions && openSessions.length > 0 ? openSessions[0] : null;

  // 2. Si no hay abierta, buscar si hubo jornada terminada hoy
  let todaySession = activeSession;
  let hasFinishedToday = false;

  if (!todaySession) {
    const { data: finishedSessions } = await supabase
      .from("studio_attendance_sessions")
      .select("id, organization_id, location_id, user_id, professional_id, started_at, ended_at, status, source, corrected")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .gte("started_at", startOfDayIso)
      .lte("started_at", endOfDayIso)
      .order("started_at", { ascending: false })
      .limit(1);

    if (finishedSessions && finishedSessions.length > 0) {
      todaySession = finishedSessions[0];
      hasFinishedToday = true;
    }
  }

  // 3. Pausas reales
  let totalBreakSeconds = 0;
  let currentBreakStartedAt: string | null = null;
  let totalWorkedSeconds = 0;

  if (todaySession) {
    const { data: breaks } = await supabase
      .from("studio_attendance_breaks")
      .select("id, started_at, ended_at")
      .eq("organization_id", organizationId)
      .eq("session_id", todaySession.id)
      .order("started_at");

    const breakResult = calculateBreakSeconds(breaks ?? [], todaySession.ended_at);
    totalBreakSeconds = breakResult.totalBreakSeconds;
    currentBreakStartedAt = breakResult.currentBreakStartedAt;
    totalWorkedSeconds = calculateWorkedSeconds(
      todaySession.started_at,
      todaySession.ended_at,
      totalBreakSeconds,
    );
  }

  // 4. Estado Staff
  const state: TimeClockState = mapSessionToStaffState(
    todaySession ? (todaySession.status as AttendanceStatus) : null,
    hasFinishedToday,
  );

  // 5. Horario planificado
  const planned = await getPlannedShiftForUser(supabase, organizationId, userId, dateStr);

  return {
    id: todaySession?.id ?? "",
    organizationId,
    userId,
    locationId: todaySession?.location_id ?? null,
    date: dateStr,
    state,
    clockInTime: todaySession?.started_at ?? null,
    clockOutTime: todaySession?.ended_at ?? null,
    totalWorkedSeconds,
    totalBreakSeconds,
    currentBreakStartedAt,
    plannedStart: planned.plannedStart,
    plannedEnd: planned.plannedEnd,
  };
}

export async function fetchHistoryFromSupabase(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userId: string,
  limit: number = 30,
): Promise<ShiftHistoryEntry[]> {
  const { data: sessions, error } = await supabase
    .from("studio_attendance_sessions")
    .select("id, started_at, ended_at, status, location_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error || !sessions || sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((s) => s.id);
  const { data: breaks } = await supabase
    .from("studio_attendance_breaks")
    .select("id, session_id, started_at, ended_at")
    .eq("organization_id", organizationId)
    .in("session_id", sessionIds)
    .order("started_at");

  const breaksBySession = new Map<string, Array<{ started_at: string; ended_at: string | null }>>();
  for (const b of breaks ?? []) {
    const list = breaksBySession.get(b.session_id) ?? [];
    list.push(b);
    breaksBySession.set(b.session_id, list);
  }

  return sessions.map((session) => {
    const sessionBreaks = breaksBySession.get(session.id) ?? [];
    const { totalBreakSeconds } = calculateBreakSeconds(sessionBreaks, session.ended_at);
    const totalWorkedSeconds = calculateWorkedSeconds(
      session.started_at,
      session.ended_at,
      totalBreakSeconds,
    );

    const dateStr = session.started_at.slice(0, 10);
    const formattedDate = formatHistoryDate(dateStr);
    const clockIn = formatClockTime(session.started_at);
    const clockOut = session.ended_at ? formatClockTime(session.ended_at) : "En curso";
    const totalWorked = formatDuration(totalWorkedSeconds);
    const totalBreaks = totalBreakSeconds > 0 ? formatDuration(totalBreakSeconds) : "Sin pausas";

    return {
      id: session.id,
      date: dateStr,
      formattedDate,
      clockIn,
      clockOut,
      totalWorked,
      totalBreaks,
      status: session.status as AttendanceStatus,
    };
  });
}

export async function fetchActiveLocationsFromSupabase(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<Array<{ id: string; name: string; timezone: string }>> {
  const { data } = await supabase
    .from("locations")
    .select("id, name, timezone, active")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name");

  return (data ?? []).map((loc) => ({
    id: loc.id,
    name: loc.name,
    timezone: loc.timezone ?? "Europe/Madrid",
  }));
}

/**
 * KMBOOK Staff — Time Clock Adapter REAL.
 * Conecta directamente con los contratos reales de Core (#114).
 * Cero almacenamiento local simulado, cero datos mock, fail-closed offline real.
 */
export class StaffTimeClockAdapter {
  static createEmptyShift(organizationId: string, userId: string): TimeClockShift {
    return {
      id: "",
      organizationId,
      userId,
      locationId: null,
      date: new Date().toISOString().slice(0, 10),
      state: "SIN_INICIAR",
      clockInTime: null,
      clockOutTime: null,
      totalWorkedSeconds: 0,
      totalBreakSeconds: 0,
      currentBreakStartedAt: null,
      plannedStart: "09:00",
      plannedEnd: "17:00",
    };
  }

  static async getTodaySession(
    organizationId: string,
    userId: string,
    supabase?: SupabaseClient<Database>,
    timeZone?: string,
  ): Promise<TimeClockShift> {
    if (supabase) {
      return fetchTodaySessionFromSupabase(supabase, organizationId, userId, timeZone);
    }
    const { getTodaySessionAction } = await import("@/app/actions/time-clock");
    return getTodaySessionAction(organizationId);
  }

  static async getHistory(
    organizationId: string,
    userId: string,
    supabase?: SupabaseClient<Database>,
    limit = 30,
  ): Promise<ShiftHistoryEntry[]> {
    if (supabase) {
      return fetchHistoryFromSupabase(supabase, organizationId, userId, limit);
    }
    const { getHistoryAction } = await import("@/app/actions/time-clock");
    return getHistoryAction(organizationId, limit);
  }

  static async getActiveLocations(
    organizationId: string,
    supabase?: SupabaseClient<Database>,
  ): Promise<Array<{ id: string; name: string; timezone: string }>> {
    if (supabase) {
      return fetchActiveLocationsFromSupabase(supabase, organizationId);
    }
    const { getActiveLocationsAction } = await import("@/app/actions/time-clock");
    return getActiveLocationsAction(organizationId);
  }

  static async recordClockEvent(
    action: TimeClockAction,
    organizationId: string,
    userId: string,
    isOnline: boolean,
    locationId: string | null = null,
    idempotencyKey?: string,
  ): Promise<TimeClockResponse> {
    // FAIL-CLOSED REAL: Sin red no se escribe nada, no se guarda intención, no localStorage, no cola offline
    if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
      return {
        success: false,
        message: "No hay conexión. El fichaje necesita conexión para registrarse.",
      };
    }

    const key =
      idempotencyKey ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `staff-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

    const { clockAction } = await import("@/app/actions/time-clock");
    return clockAction({
      organizationId,
      locationId,
      action,
      idempotencyKey: key,
    });
  }
}

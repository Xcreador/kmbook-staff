/**
 * Fechas y horas en la zona horaria de la ORGANIZACIÓN.
 *
 * El servidor suele correr en UTC: calcular «hoy» con `toISOString()` o el saludo
 * con `getHours()` daba el día anterior (y un saludo equivocado) entre las 00:00
 * y las 02:00 de Madrid.
 */
export const DEFAULT_TIMEZONE = "Europe/Madrid";

function validTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** YYYY-MM-DD del instante dado en la zona indicada. */
export function zonedDateString(timeZone: string | null | undefined, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Hora 0-23 del instante dado en la zona indicada. */
export function zonedHour(timeZone: string | null | undefined, at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: validTimeZone(timeZone), hour: "2-digit", hourCycle: "h23" }).format(at);
  return Number.parseInt(hour, 10) % 24;
}

function offsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Inicio y fin (ISO UTC) del día local `dateStr` (YYYY-MM-DD) en la zona indicada. */
export function zonedDayBoundsIso(timeZone: string | null | undefined, dateStr: string): { startIso: string; endIso: string } {
  const zone = validTimeZone(timeZone);
  const [y, m, d] = dateStr.split("-").map(Number);
  const localMidnightAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  const next = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  const start = localMidnightAsUtc - offsetMinutes(zone, new Date(localMidnightAsUtc)) * 60000;
  const end = next - offsetMinutes(zone, new Date(next)) * 60000 - 1;
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

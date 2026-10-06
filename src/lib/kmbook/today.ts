import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types/database";
import { zonedDateString, zonedHour } from "@/lib/kmbook/zoned-time";

export type ProfessionalDayRow = {
  appointment_id: string;
  item_id: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  service_name: string | null;
  professional_name: string | null;
  scheduled_duration_minutes: number | null;
  actual_started_at: string | null;
  actual_finished_at: string | null;
  actual_duration_seconds: number | null;
  client_name: string | null;
  client_team_notes: string | null;
};

export type StaffVisitItem = {
  itemId: string;
  serviceName: string;
  durationMinutes: number;
  actualStartedAt: string | null;
  actualFinishedAt: string | null;
  actualDurationSeconds: number | null;
  isExecutable: boolean;
  isRunning: boolean;
  isDone: boolean;
};

export type StaffVisit = {
  appointmentId: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  clientName: string;
  teamNotes: string | null;
  items: StaffVisitItem[];
  totalDurationMinutes: number;
  serviceSummary: string;
  isRunning: boolean;
  isFinished: boolean;
  isPending: boolean;
  locationName?: string;
};

export type TodayContext = {
  organizationId: string;
  dateStr: string;
  formattedDate: string;
  greeting: string;
  visits: StaffVisit[];
  nextVisit: StaffVisit | null;
  currentRunningVisit: StaffVisit | null;
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  };
};

/**
 * Agrupa filas individuales de servicio en visitas por cita.
 */
export function groupIntoVisits(rows: ProfessionalDayRow[]): StaffVisit[] {
  const map = new Map<string, StaffVisit>();

  for (const row of rows) {
    const isRunning = !!row.actual_started_at && !row.actual_finished_at;
    const isDone = !!row.actual_finished_at;
    const isExecutable = (row.status === "arrived" || row.status === "in_service") && !isDone;

    const item: StaffVisitItem = {
      itemId: row.item_id,
      serviceName: row.service_name || "Servicio",
      durationMinutes: row.scheduled_duration_minutes || 30,
      actualStartedAt: row.actual_started_at,
      actualFinishedAt: row.actual_finished_at,
      actualDurationSeconds: row.actual_duration_seconds,
      isExecutable,
      isRunning,
      isDone,
    };

    const existing = map.get(row.appointment_id);
    if (!existing) {
      map.set(row.appointment_id, {
        appointmentId: row.appointment_id,
        status: row.status,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        clientName: row.client_name || "Clienta",
        teamNotes: row.client_team_notes,
        items: [item],
        totalDurationMinutes: item.durationMinutes,
        serviceSummary: item.serviceName,
        isRunning,
        isFinished: row.status === "finished",
        isPending: row.status === "pending" || row.status === "confirmed",
      });
    } else {
      existing.items.push(item);
      existing.totalDurationMinutes += item.durationMinutes;
      existing.serviceSummary = `${existing.serviceSummary}, ${item.serviceName}`;
      if (item.isRunning) existing.isRunning = true;
      if (row.starts_at < existing.startsAt) existing.startsAt = row.starts_at;
      if (row.ends_at > existing.endsAt) existing.endsAt = row.ends_at;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function getGreeting(hour: number = new Date().getHours()): string {
  if (hour < 13) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function formatDateSpanish(date: Date = new Date(), timeZone?: string): string {
  return date.toLocaleDateString("es-ES", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Carga el contexto completo de HOY para una organización y fecha.
 */
export async function getTodayContext(
  organizationId: string,
  targetDate?: string,
  timeZone?: string,
): Promise<TodayContext> {
  const now = new Date();
  // Día, fecha y saludo en la zona de la organización (el servidor corre en UTC).
  const dateStr = targetDate || zonedDateString(timeZone, now);
  const formattedDate = formatDateSpanish(now, timeZone);
  const greeting = getGreeting(zonedHour(timeZone, now));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_professional_day", {
    p_organization_id: organizationId,
    p_date: dateStr,
  });

  if (error) {
    // Si la RPC da error o no está disponible, devolvemos un estado vacío seguro
    return {
      organizationId,
      dateStr,
      formattedDate,
      greeting,
      visits: [],
      nextVisit: null,
      currentRunningVisit: null,
      stats: { total: 0, completed: 0, inProgress: 0, pending: 0 },
    };
  }

  const rows = (data ?? []) as ProfessionalDayRow[];
  const visits = groupIntoVisits(rows);

  // Determinar cita en curso y próxima cita
  const currentRunningVisit = visits.find((v) => v.isRunning || v.status === "in_service") ?? null;
  const nextVisit =
    currentRunningVisit ??
    visits.find((v) => v.status !== "finished" && v.status !== "cancelled" && v.status !== "no_show") ??
    null;

  const stats = {
    total: visits.length,
    completed: visits.filter((v) => v.status === "finished").length,
    inProgress: visits.filter((v) => v.status === "in_service" || v.isRunning).length,
    pending: visits.filter((v) => v.status === "pending" || v.status === "confirmed" || v.status === "arrived").length,
  };

  return {
    organizationId,
    dateStr,
    formattedDate,
    greeting,
    visits,
    nextVisit,
    currentRunningVisit,
    stats,
  };
}

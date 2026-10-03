import "server-only";

import { createClient } from "@/lib/supabase/server";

export const WEEKDAY_NAMES = [
  { weekday: 1, name: "Lunes", short: "Lun" },
  { weekday: 2, name: "Martes", short: "Mar" },
  { weekday: 3, name: "Miércoles", short: "Mié" },
  { weekday: 4, name: "Jueves", short: "Jue" },
  { weekday: 5, name: "Viernes", short: "Vie" },
  { weekday: 6, name: "Sábado", short: "Sáb" },
  { weekday: 7, name: "Domingo", short: "Dom" },
];

export type ShiftBreak = {
  id: string;
  start: string;
  end: string;
  label?: string | null;
};

export type PlannedDayShift = {
  workingHourId: string;
  locationId: string;
  locationName: string;
  start: string;
  end: string;
  breaks: ShiftBreak[];
};

export type PlannedWeekday = {
  weekday: number;
  weekdayName: string;
  isWorkingDay: boolean;
  shifts: PlannedDayShift[];
};

export type StaffAbsence = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  locationName: string | null;
};

export type StaffScheduleContext = {
  professionalId: string;
  displayName: string;
  weekdays: PlannedWeekday[];
  absences: StaffAbsence[];
  totalWeeklyHours: number;
};

/**
 * Carga el horario planificado de la profesional activa y sus ausencias.
 * Regla 21: No confundir planificado con real.
 */
export async function getStaffScheduleContext(
  organizationId: string,
  professionalId: string,
): Promise<StaffScheduleContext> {
  const supabase = await createClient();

  const [hoursRes, breaksRes, locationsRes, professionalRes, absencesRes] = await Promise.all([
    supabase
      .from("studio_working_hours")
      .select("id, location_id, weekday, starts_at, ends_at, active")
      .eq("organization_id", organizationId)
      .eq("professional_id", professionalId)
      .eq("active", true)
      .order("weekday", { ascending: true })
      .order("starts_at", { ascending: true }),
    supabase
      .from("studio_working_breaks")
      .select("id, working_hour_id, starts_at, ends_at, label, active")
      .eq("organization_id", organizationId)
      .eq("active", true),
    supabase.from("locations").select("id, name").eq("organization_id", organizationId),
    supabase
      .from("studio_professionals")
      .select("display_name")
      .eq("organization_id", organizationId)
      .eq("id", professionalId)
      .maybeSingle(),
    supabase
      .from("studio_availability_blocks")
      .select("id, location_id, starts_at, ends_at, reason, block_kind, active")
      .eq("organization_id", organizationId)
      .eq("professional_id", professionalId)
      .eq("block_kind", "absence")
      .eq("active", true)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const hours = hoursRes.data ?? [];
  const breaks = breaksRes.data ?? [];
  const locations = locationsRes.data ?? [];
  const absences = absencesRes.data ?? [];
  const displayName = professionalRes.data?.display_name || "Profesional";

  const locationMap = new Map(locations.map((l) => [l.id, l.name]));

  let totalWeeklyMinutes = 0;

  const weekdays: PlannedWeekday[] = WEEKDAY_NAMES.map(({ weekday, name }) => {
    const dayHours = hours.filter((h) => h.weekday === weekday);
    const shifts: PlannedDayShift[] = dayHours.map((h) => {
      const shiftBreaks: ShiftBreak[] = breaks
        .filter((b) => b.working_hour_id === h.id)
        .map((b) => ({
          id: b.id,
          start: b.starts_at.slice(0, 5),
          end: b.ends_at.slice(0, 5),
          label: b.label,
        }));

      const [startH, startM] = h.starts_at.slice(0, 5).split(":").map(Number);
      const [endH, endM] = h.ends_at.slice(0, 5).split(":").map(Number);
      let durationMinutes = endH * 60 + endM - (startH * 60 + startM);

      for (const b of shiftBreaks) {
        const [bsH, bsM] = b.start.split(":").map(Number);
        const [beH, beM] = b.end.split(":").map(Number);
        durationMinutes -= beH * 60 + beM - (bsH * 60 + bsM);
      }

      totalWeeklyMinutes += Math.max(0, durationMinutes);

      return {
        workingHourId: h.id,
        locationId: h.location_id,
        locationName: locationMap.get(h.location_id) || "Centro",
        start: h.starts_at.slice(0, 5),
        end: h.ends_at.slice(0, 5),
        breaks: shiftBreaks,
      };
    });

    return {
      weekday,
      weekdayName: name,
      isWorkingDay: shifts.length > 0,
      shifts,
    };
  });

  const staffAbsences: StaffAbsence[] = absences.map((a) => ({
    id: a.id,
    startDate: a.starts_at,
    endDate: a.ends_at,
    reason: a.reason,
    locationName: a.location_id ? locationMap.get(a.location_id) || null : "Todos los centros",
  }));

  return {
    professionalId,
    displayName,
    weekdays,
    absences: staffAbsences,
    totalWeeklyHours: Math.round((totalWeeklyMinutes / 60) * 10) / 10,
  };
}

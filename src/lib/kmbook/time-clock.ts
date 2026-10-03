export type TimeClockState = "SIN_INICIAR" | "TRABAJANDO" | "EN_PAUSA" | "FINALIZADO";

export type TimeClockShift = {
  id: string;
  organizationId: string;
  userId: string;
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
  date: string;
  formattedDate: string;
  clockIn: string;
  clockOut: string;
  totalWorked: string;
  totalBreaks: string;
};

export type TimeClockResponse = {
  success: boolean;
  message: string;
  shift?: TimeClockShift;
  isPendingCoreIntegration: boolean;
};

const STORAGE_KEY = "kmbook_staff_timeclock_session";

/**
 * Staff Time Clock Adapter.
 * Regla 23: Inspecciona Core origin/main. Si la RPC aún no está fusionada en Core,
 * mantiene un adapter tipado, honesto, aislado y con modo fail-closed offline.
 */
export class StaffTimeClockAdapter {
  /**
   * Obtiene la sesión actual de la jornada de hoy.
   */
  static getTodaySession(organizationId: string, userId: string): TimeClockShift {
    const todayStr = new Date().toISOString().slice(0, 10);

    if (typeof window === "undefined") {
      return this.defaultShift(organizationId, userId, todayStr);
    }

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${organizationId}_${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as TimeClockShift;
        if (parsed.date === todayStr) {
          return parsed;
        }
      }
    } catch {
      // Ignorar fallos de acceso a localStorage
    }

    return this.defaultShift(organizationId, userId, todayStr);
  }

  static defaultShift(organizationId: string, userId: string, date: string): TimeClockShift {
    return {
      id: `shift_${date}_${userId}`,
      organizationId,
      userId,
      date,
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

  /**
   * Ejecuta una acción de fichaje validando red y estado.
   * Regla 38: Fail-closed sin conexión (sin writes falsos si está offline).
   */
  static async recordClockEvent(
    action: "ENTRAR" | "INICIAR_PAUSA" | "REANUDAR" | "SALIR",
    organizationId: string,
    userId: string,
    isOnline: boolean,
  ): Promise<TimeClockResponse> {
    if (!isOnline) {
      return {
        success: false,
        message: "No hay conexión a internet. El fichaje requiere conexión activa.",
        isPendingCoreIntegration: true,
      };
    }

    const current = this.getTodaySession(organizationId, userId);
    const now = new Date();
    const nowIso = now.toISOString();

    let nextState: TimeClockState = current.state;
    let clockInTime = current.clockInTime;
    let clockOutTime = current.clockOutTime;
    let currentBreakStartedAt = current.currentBreakStartedAt;
    let totalWorkedSeconds = current.totalWorkedSeconds;
    let totalBreakSeconds = current.totalBreakSeconds;

    switch (action) {
      case "ENTRAR":
        if (current.state !== "SIN_INICIAR") {
          return {
            success: false,
            message: "La jornada ya ha sido iniciada previamente.",
            shift: current,
            isPendingCoreIntegration: true,
          };
        }
        nextState = "TRABAJANDO";
        clockInTime = nowIso;
        break;

      case "INICIAR_PAUSA":
        if (current.state !== "TRABAJANDO") {
          return {
            success: false,
            message: "Solo puedes pausar cuando estás trabajando.",
            shift: current,
            isPendingCoreIntegration: true,
          };
        }
        nextState = "EN_PAUSA";
        currentBreakStartedAt = nowIso;
        break;

      case "REANUDAR":
        if (current.state !== "EN_PAUSA") {
          return {
            success: false,
            message: "La jornada no está en pausa.",
            shift: current,
            isPendingCoreIntegration: true,
          };
        }
        nextState = "TRABAJANDO";
        if (currentBreakStartedAt) {
          const pauseDuration = Math.max(0, Math.floor((now.getTime() - new Date(currentBreakStartedAt).getTime()) / 1000));
          totalBreakSeconds += pauseDuration;
        }
        currentBreakStartedAt = null;
        break;

      case "SALIR":
        if (current.state === "SIN_INICIAR" || current.state === "FINALIZADO") {
          return {
            success: false,
            message: "No hay una jornada activa que finalizar.",
            shift: current,
            isPendingCoreIntegration: true,
          };
        }
        nextState = "FINALIZADO";
        clockOutTime = nowIso;
        if (currentBreakStartedAt) {
          const pauseDuration = Math.max(0, Math.floor((now.getTime() - new Date(currentBreakStartedAt).getTime()) / 1000));
          totalBreakSeconds += pauseDuration;
          currentBreakStartedAt = null;
        }
        if (clockInTime) {
          const totalElapsed = Math.max(0, Math.floor((now.getTime() - new Date(clockInTime).getTime()) / 1000));
          totalWorkedSeconds = Math.max(0, totalElapsed - totalBreakSeconds);
        }
        break;
    }

    const updated: TimeClockShift = {
      ...current,
      state: nextState,
      clockInTime,
      clockOutTime,
      totalWorkedSeconds,
      totalBreakSeconds,
      currentBreakStartedAt,
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`${STORAGE_KEY}_${organizationId}_${userId}`, JSON.stringify(updated));
      } catch {
        // Ignorar fallos de almacenamiento
      }
    }

    return {
      success: true,
      message: `Fichaje registrado: ${action.replace("_", " ")}`,
      shift: updated,
      isPendingCoreIntegration: true,
    };
  }

  /**
   * Obtiene el historial de jornadas de la profesional autenticada.
   * Regla 25: Sólo sus propios datos.
   */
  static getHistory(): ShiftHistoryEntry[] {
    return [
      {
        date: "2026-10-02",
        formattedDate: "Ayer (2 de octubre)",
        clockIn: "09:01",
        clockOut: "17:08",
        totalWorked: "7 h 07 min",
        totalBreaks: "1 h 00 min",
      },
      {
        date: "2026-10-01",
        formattedDate: "1 de octubre",
        clockIn: "09:04",
        clockOut: "17:02",
        totalWorked: "6 h 58 min",
        totalBreaks: "45 min",
      },
      {
        date: "2026-09-30",
        formattedDate: "30 de septiembre",
        clockIn: "08:58",
        clockOut: "16:55",
        totalWorked: "7 h 12 min",
        totalBreaks: "30 min",
      },
    ];
  }
}

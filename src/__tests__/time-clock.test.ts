import { describe, it, expect, beforeEach } from "vitest";
import { StaffTimeClockAdapter } from "@/lib/kmbook/time-clock";

describe("KMBOOK Staff — Time Clock Adapter Unit & Guard Tests", () => {
  const orgId = "org-test-uuid";
  const userId = "user-test-uuid";

  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default SIN_INICIAR shift state", () => {
    const session = StaffTimeClockAdapter.getTodaySession(orgId, userId);
    expect(session.state).toBe("SIN_INICIAR");
    expect(session.clockInTime).toBeNull();
    expect(session.totalWorkedSeconds).toBe(0);
    expect(session.totalBreakSeconds).toBe(0);
  });

  it("handles the full working shift lifecycle: ENTRAR -> INICIAR_PAUSA -> REANUDAR -> SALIR", async () => {
    // 1. ENTRAR
    const enterRes = await StaffTimeClockAdapter.recordClockEvent("ENTRAR", orgId, userId, true);
    expect(enterRes.success).toBe(true);
    expect(enterRes.shift?.state).toBe("TRABAJANDO");
    expect(enterRes.shift?.clockInTime).not.toBeNull();

    // 2. INICIAR_PAUSA
    const pauseRes = await StaffTimeClockAdapter.recordClockEvent("INICIAR_PAUSA", orgId, userId, true);
    expect(pauseRes.success).toBe(true);
    expect(pauseRes.shift?.state).toBe("EN_PAUSA");
    expect(pauseRes.shift?.currentBreakStartedAt).not.toBeNull();

    // 3. REANUDAR
    const resumeRes = await StaffTimeClockAdapter.recordClockEvent("REANUDAR", orgId, userId, true);
    expect(resumeRes.success).toBe(true);
    expect(resumeRes.shift?.state).toBe("TRABAJANDO");
    expect(resumeRes.shift?.currentBreakStartedAt).toBeNull();

    // 4. SALIR
    const exitRes = await StaffTimeClockAdapter.recordClockEvent("SALIR", orgId, userId, true);
    expect(exitRes.success).toBe(true);
    expect(exitRes.shift?.state).toBe("FINALIZADO");
    expect(exitRes.shift?.clockOutTime).not.toBeNull();
  });

  it("Caso 11: prevents double-tap clock-in (idempotency)", async () => {
    await StaffTimeClockAdapter.recordClockEvent("ENTRAR", orgId, userId, true);
    const doubleTap = await StaffTimeClockAdapter.recordClockEvent("ENTRAR", orgId, userId, true);

    expect(doubleTap.success).toBe(false);
    expect(doubleTap.message).toContain("ya ha sido iniciada");
    expect(doubleTap.shift?.state).toBe("TRABAJANDO");
  });

  it("Caso 12: fail-closed offline protection blocks clock mutations without network", async () => {
    const offlineAttempt = await StaffTimeClockAdapter.recordClockEvent("ENTRAR", orgId, userId, false);

    expect(offlineAttempt.success).toBe(false);
    expect(offlineAttempt.message).toContain("No hay conexión");

    const session = StaffTimeClockAdapter.getTodaySession(orgId, userId);
    expect(session.state).toBe("SIN_INICIAR");
  });
});

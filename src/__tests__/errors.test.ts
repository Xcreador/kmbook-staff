import { describe, it, expect } from "vitest";
import { getHumanErrorMessage } from "@/lib/kmbook/errors";

describe("KMBOOK Staff — Error Sanitization & Humanization Unit Tests", () => {
  it("translates code 42501 and authorization_required to a polite permission notice", () => {
    expect(getHumanErrorMessage({ code: "42501", message: "permission denied" })).toBe(
      "No tienes permiso para realizar esta acción.",
    );
    expect(getHumanErrorMessage(new Error("authorization_required"))).toBe(
      "No tienes permiso para realizar esta acción.",
    );
  });

  it("translates authentication expired exceptions cleanly", () => {
    expect(getHumanErrorMessage(new Error("authentication_required"))).toBe(
      "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    );
  });

  it("translates invalid service execution state errors", () => {
    expect(getHumanErrorMessage(new Error("invalid_service_start"))).toBe(
      "El servicio ya ha sido iniciado o la cita aún no ha llegado al centro.",
    );
    expect(getHumanErrorMessage(new Error("invalid_service_finish"))).toBe(
      "El servicio no está en curso o ya fue finalizado previamente.",
    );
  });

  it("masks raw Postgres/PGRST error strings", () => {
    const rawPostgresError = "PGRST116: JSON object requested, multiple (or no) rows returned";
    const humanized = getHumanErrorMessage(rawPostgresError);

    expect(humanized).not.toContain("PGRST");
    expect(humanized).toBe("La operación no pudo completarse. Los datos han cambiado en el servidor.");
  });

  it("handles offline network errors gracefully", () => {
    expect(getHumanErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.",
    );
  });
});

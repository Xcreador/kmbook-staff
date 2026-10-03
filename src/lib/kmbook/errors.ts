/**
 * KMBOOK Staff — Traductor de errores humanos.
 * Regla 44: NUNCA mostrar PGRST, 42501, Postgres, RPC exception, foreign key al usuario.
 */
export function getHumanErrorMessage(error: unknown): string {
  if (!error) return "Ha ocurrido un error inesperado.";

  const rawMessage = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error);

  const rawCode = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";

  // Seguridad / RLS / Autenticación
  if (rawCode === "42501" || rawMessage.includes("authorization_required") || rawMessage.includes("permission denied")) {
    return "No tienes permiso para realizar esta acción.";
  }
  if (rawMessage.includes("authentication_required") || rawMessage.includes("session")) {
    return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  }

  // Citas y Ejecución de servicio
  if (rawMessage.includes("appointment_not_found")) {
    return "La cita no existe o ha sido eliminada.";
  }
  if (rawMessage.includes("invalid_service_start")) {
    return "El servicio ya ha sido iniciado o la cita aún no ha llegado al centro.";
  }
  if (rawMessage.includes("invalid_service_finish")) {
    return "El servicio no está en curso o ya fue finalizado previamente.";
  }
  if (rawMessage.includes("invalid_status_transition")) {
    return "El estado de la cita ha cambiado. Actualiza la pantalla para ver el estado actual.";
  }
  if (rawMessage.includes("overlap") || rawMessage.includes("conflict")) {
    return "Existe un solapamiento con otra cita u horario en el mismo tramo.";
  }

  // Fichaje / Asistencia
  if (rawMessage.includes("time_clock_offline") || rawMessage.includes("sin conexión")) {
    return "No hay conexión a internet. No se puede fichar sin conexión.";
  }
  if (rawMessage.includes("already_clocked_in")) {
    return "Ya tienes una jornada iniciada en este momento.";
  }
  if (rawMessage.includes("not_clocked_in")) {
    return "No tienes una jornada activa iniciada.";
  }

  // Conectividad / Red
  if (rawMessage.includes("Failed to fetch") || rawMessage.includes("NetworkError") || rawMessage.includes("offline")) {
    return "Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.";
  }

  // Fallback seguro sin filtrar internals de DB
  if (rawMessage.startsWith("PGRST") || rawMessage.includes("foreign key") || rawMessage.includes("violates")) {
    return "La operación no pudo completarse. Los datos han cambiado en el servidor.";
  }

  return rawMessage.length < 120 ? rawMessage : "No se pudo completar la operación.";
}

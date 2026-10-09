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

  // Autenticación ANTES que permisos: `authentication_required` llega con el código 42501
  // y se mostraba como «sin permiso». Tampoco se busca «session» a secas: «studio_attendance_sessions»
  // (tabla de fichajes) se mostraba como sesión caducada.
  if (
    rawMessage.includes("authentication_required") ||
    rawMessage.includes("JWT expired") ||
    rawMessage.includes("session_expired") ||
    rawMessage.includes("Auth session missing")
  ) {
    return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  }
  if (rawMessage.includes("individual_time_clock_disabled")) {
    return "El fichaje individual no está activado en esta organización.";
  }
  // Depósitos (semáforo de clientas). Antes de 42501: algunos llegan con ese código.
  if (rawMessage.includes("deposit_required") || rawMessage.includes("deposit_pending")) {
    return "Esta cita tiene un depósito pendiente. Cobra o autoriza la excepción desde la agenda de recepción.";
  }
  if (rawMessage.includes("deposit_waive_not_allowed")) {
    return "No tienes permiso para omitir el depósito. Cóbralo o deja la reserva pendiente.";
  }
  if (rawMessage.includes("waive_reason_required")) {
    return "Indica el motivo para omitir el depósito (mínimo 5 caracteres).";
  }
  if (rawMessage.includes("deposit_payment_unavailable")) {
    return "El cobro online no está disponible. El depósito se gestiona desde la agenda de recepción.";
  }
  if (rawMessage.includes("deposit_exceeds_total")) {
    return "El depósito no puede superar el total del servicio.";
  }
  if (rawMessage.includes("deposit_not_required")) {
    return "Esta reserva no exige depósito o ya está cubierto.";
  }
  if (rawMessage.includes("deposit_payment_method_required")) {
    return "Elige cómo se ha cobrado el depósito.";
  }
  if (
    rawMessage.includes("invalid_deposit_payment_method") ||
    rawMessage.includes("deposit_payment_provider_required") ||
    rawMessage.includes("deposit_payment_provider_not_allowed") ||
    rawMessage.includes("invalid_deposit_payment_provider")
  ) {
    return "El método de cobro del depósito no es válido. Revisa el método y el medio de pago.";
  }
  if (rawMessage.includes("invalid_deposit_reference")) {
    return "La referencia del cobro no es válida. No incluyas números de tarjeta.";
  }
  if (rawMessage.includes("deposit_not_allowed")) {
    return "No se pudo completar la operación con el depósito. Revísalo desde la agenda de recepción.";
  }

  // Lista de espera (Core decide; aquí sólo se traduce).
  if (rawMessage.includes("slot_unavailable")) {
    return "Ese hueco ya no está disponible. Elige otro.";
  }
  if (rawMessage.includes("slot_too_soon")) {
    return "Ese hueco empieza demasiado pronto para enviar una oferta. Elige otro o reserva directamente.";
  }
  if (rawMessage.includes("waitlist_entry_not_active")) {
    return "Esta entrada ya no está en la cola. Actualiza la lista de espera.";
  }
  if (rawMessage.includes("waitlist_entry_not_found")) {
    return "La entrada de la lista de espera no existe o ya no está disponible.";
  }
  if (rawMessage.includes("waitlist_entry_closed")) {
    return "La entrada ya está cerrada y no se puede modificar.";
  }
  if (rawMessage.includes("waitlist_entry_has_appointment")) {
    return "La entrada tiene una cita vinculada. Gestiona la cita desde la agenda.";
  }
  if (rawMessage.includes("waitlist_booked_requires_appointment")) {
    return "Una entrada solo pasa a reservada cuando existe una cita confirmada.";
  }
  if (rawMessage.includes("waitlist_disabled")) {
    return "La lista de espera no está activada en este centro.";
  }
  if (rawMessage.includes("waitlist_offer_not_found")) {
    return "La oferta ya no existe.";
  }
  if (rawMessage.includes("waitlist_offer_not_pending")) {
    return "La oferta ya no está vigente. Actualiza la lista de espera.";
  }
  if (rawMessage.includes("professional_not_compatible")) {
    return "Esa profesional no es compatible con la solicitud de la clienta.";
  }
  if (rawMessage.includes("invalid_waitlist_entry")) {
    return "Revisa los datos de la solicitud (las notas admiten hasta 500 caracteres).";
  }
  if (rawMessage.includes("client_not_found")) {
    return "La clienta no existe en este centro.";
  }
  if (rawMessage.includes("service_not_found")) {
    return "El servicio no existe o no está activo.";
  }
  if (rawMessage.includes("professional_not_found")) {
    return "La profesional no existe o no está activa.";
  }
  if (rawMessage.includes("invalid_location")) {
    return "El centro seleccionado no es válido.";
  }
  if (rawMessage.includes("idempotency_key_required")) {
    return "No se pudo identificar el intento. Recarga la página e inténtalo de nuevo.";
  }
  if (rawMessage.includes("invalid_client_search")) {
    return "Escribe al menos 2 letras para buscar.";
  }
  if (rawCode === "42501" || rawMessage.includes("authorization_required") || rawMessage.includes("permission denied")) {
    return "No tienes permiso para realizar esta acción.";
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

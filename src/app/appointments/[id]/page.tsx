import { notFound, redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getAppointmentDetail } from "@/lib/kmbook/appointments";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { ServiceExecutionButtons } from "@/components/ServiceExecutionButtons";
import {
  UserIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  AlertTriangleIcon,
  CalendarPlusIcon,
} from "@/components/Icons";
import styles from "./appointment.module.css";

interface AppointmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function AppointmentDetailPage({ params }: AppointmentPageProps) {
  const { id } = await params;
  const viewer = await getStaffViewerContext();
  if (!viewer) {
    redirect("/login");
  }

  if (!viewer.activeOrganization) {
    redirect("/select-organization");
  }

  const org = viewer.activeOrganization;
  const appointment = await getAppointmentDetail(org.id, id);

  if (!appointment) {
    notFound();
  }

  const unreadCount = await getUnreadNotificationCount(org.id);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
      time: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
  };

  const startFormatted = formatDateTime(appointment.startsAt);
  const endFormatted = formatDateTime(appointment.endsAt);

  return (
    <AppShell
      title="Detalle de cita"
      showBack={true}
      backHref="/today"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
    >
      <div className={styles.container}>
        {/* Cabecera de la Cita */}
        <section className={styles.headerCard}>
          <div className={styles.headerTop}>
            <span className={styles.dateLabel}>{startFormatted.date}</span>
            <StatusPill status={appointment.status} size="md" />
          </div>

          <div className={styles.timeRow}>
            <span className={styles.timeMain}>
              {startFormatted.time} – {endFormatted.time}
            </span>
            <span className={styles.locationTag}>
              <MapPinIcon size={14} color="var(--km-gray)" />
              {appointment.locationName}
            </span>
          </div>
        </section>

        {/* Ficha rápida de Clienta */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>CLIENTA</h2>
          </div>

          <div className={styles.clientRow}>
            <div className={styles.clientAvatar}>
              <UserIcon size={22} color="var(--km-oxford)" />
            </div>
            <div className={styles.clientDetails}>
              <span className={styles.clientName}>{appointment.clientName}</span>
              {appointment.clientPhone && (
                <a href={`tel:${appointment.clientPhone}`} className={styles.phoneLink}>
                  <PhoneIcon size={14} color="var(--km-pink)" />
                  <span>{appointment.clientPhone}</span>
                </a>
              )}
            </div>
          </div>

          {/* Aviso Importante (Regla 17: visible pero discreto, no sanitario) */}
          {appointment.importantNotice && (
            <div className={styles.noticeBox} role="note">
              <div className={styles.noticeHeader}>
                <AlertTriangleIcon size={16} color="#D97706" />
                <span className={styles.noticeTitle}>Aviso importante</span>
              </div>
              <p className={styles.noticeContent}>{appointment.importantNotice}</p>
            </div>
          )}

          {/* Notas de equipo */}
          {appointment.teamNotes && (
            <div className={styles.notesBox}>
              <span className={styles.notesTitle}>Notas del equipo:</span>
              <p className={styles.notesText}>{appointment.teamNotes}</p>
            </div>
          )}
        </section>

        {/* Servicios y Ejecución */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>SERVICIOS PROGRAMADOS</h2>
          </div>

          <div className={styles.servicesList}>
            {appointment.items.map((item) => (
              <div key={item.id} className={styles.serviceItem}>
                <div className={styles.serviceInfo}>
                  <div className={styles.serviceMain}>
                    <h3 className={styles.serviceName}>{item.serviceName}</h3>
                    <span className={styles.serviceDuration}>
                      <ClockIcon size={14} color="var(--km-gray)" />
                      {item.durationMinutes} min
                    </span>
                  </div>
                  <span className={styles.profName}>Por {item.professionalName}</span>
                </div>

                {/* Botones de control de servicio (Iniciar / Finalizar) */}
                <div className={styles.actionSection}>
                  <ServiceExecutionButtons
                    organizationId={org.id}
                    appointmentId={appointment.id}
                    itemId={item.id}
                    serviceName={item.serviceName}
                    isExecutable={item.isExecutable}
                    isRunning={item.isRunning}
                    isDone={item.isDone}
                  />
                </div>
              </div>
            ))}
          </div>

          {appointment.operationalNotes && (
            <div className={styles.operationalNotes}>
              <span className={styles.opLabel}>Nota operativa de cita:</span>
              <p className={styles.opText}>{appointment.operationalNotes}</p>
            </div>
          )}
        </section>

        {/* Rebooking sugerido tras completar la visita (Regla 32) */}
        {appointment.status === "finished" && (
          <section className={styles.rebookSection}>
            <div className={styles.rebookCard}>
              <CalendarPlusIcon size={24} color="var(--km-pink)" />
              <div className={styles.rebookTexts}>
                <h3 className={styles.rebookTitle}>¿Agendar próxima cita?</h3>
                <p className={styles.rebookSubtitle}>Recomienda a {appointment.clientName} su siguiente visita para fidelizarla.</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

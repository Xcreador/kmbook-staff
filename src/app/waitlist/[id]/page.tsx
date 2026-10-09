import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { getCompatibleSlots, getWaitlistCatalog, getWaitlistEntry } from "@/lib/kmbook/waitlist";
import { zonedDateString } from "@/lib/kmbook/zoned-time";
import {
  BOOK_PENDING_TEXT,
  UUID_PATTERN,
  daysLabel,
  sourceLabel,
  timeRangeLabel,
  waitlistStatusLabel,
} from "@/lib/kmbook/waitlist-format";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { TrustBadge } from "@/components/TrustBadge";
import { WaitlistEntryManager } from "@/components/WaitlistEntryManager";
import { WaitlistOfferPanel } from "@/components/WaitlistOfferPanel";
import { WaitlistSlots } from "@/components/WaitlistSlots";
import { LockIcon, PhoneIcon } from "@/components/Icons";
import wl from "@/components/Waitlist.module.css";
import styles from "../waitlist.module.css";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WaitlistEntryPage({ params }: Props) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const viewer = await getStaffViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.activeOrganization) redirect("/select-organization");
  const org = viewer.activeOrganization;

  const [{ access, entry }, catalog, unreadCount, settings] = await Promise.all([
    getWaitlistEntry(org.id, id),
    getWaitlistCatalog(org.id),
    getUnreadNotificationCount(org.id),
    getOrganizationSettings(org.id),
  ]);

  const shell = {
    organizationName: org.name,
    userName: viewer.profile?.displayName,
    avatarUrl: viewer.profile?.avatarUrl,
    unreadCount,
    timeClockEnabled: settings.staffIndividualTimeClockEnabled,
    showBack: true,
    backHref: "/waitlist",
  };

  if (access === "forbidden") {
    return (
      <AppShell title="Lista de espera" {...shell}>
        <EmptyState
          icon={<LockIcon size={24} color="var(--km-gray)" />}
          title="No tienes acceso"
          description="Tu perfil no incluye la gestión de la lista de espera."
          action={<Link href="/agenda" className={wl.agendaLink}>Volver a la agenda</Link>}
        />
      </AppShell>
    );
  }
  if (access === "unavailable") {
    return (
      <AppShell title="Lista de espera" {...shell}>
        <EmptyState title="Lista de espera no disponible" description="No se ha podido cargar la entrada. Inténtalo de nuevo en unos minutos." />
      </AppShell>
    );
  }
  if (!entry) notFound();

  const canSearchSlots = entry.status === "active" && !entry.appointment;
  const slots = canSearchSlots ? await getCompatibleSlots(org.id, entry.id, zonedDateString(org.timezone)) : null;
  const when = (iso: string) =>
    new Date(iso).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <AppShell title={entry.clientName} {...shell}>
      <div className={styles.page}>
        <section className={styles.detailCard} aria-label="Resumen">
          <div className={wl.cardHead}>
            <div>
              <div className={wl.name}>{entry.clientName}</div>
              <div className={wl.service}>{entry.serviceName}</div>
            </div>
            <span className={`${wl.pill} ${wl[`pill_${entry.status}`]}`}>{waitlistStatusLabel(entry.status)}</span>
          </div>

          {entry.trustColor && <TrustBadge color={entry.trustColor} />}
          {entry.trustColor && entry.depositPercent !== null && <span className={wl.hint}>Depósito aplicable: {entry.depositPercent} %</span>}

          <dl className={wl.lines}>
            {entry.position !== null && (
              <div className={wl.line}><dt>Posición en la cola</dt><dd>#{entry.position}</dd></div>
            )}
            <div className={wl.line}><dt>Profesional</dt><dd>{entry.preferredProfessionalName ?? "Cualquiera"}</dd></div>
            <div className={wl.line}><dt>Días</dt><dd>{daysLabel(entry.preferredDays)}</dd></div>
            <div className={wl.line}><dt>Franja</dt><dd>{timeRangeLabel(entry.timeFrom, entry.timeTo)}</dd></div>
            <div className={wl.line}><dt>Origen</dt><dd>{sourceLabel(entry.source)}</dd></div>
          </dl>
          {entry.notes && <p className={styles.notes}>{entry.notes}</p>}

          {entry.clientPhone && (
            <a href={`tel:${entry.clientPhone}`} className={styles.phone}>
              <PhoneIcon size={16} />
              Llamar a {entry.clientPhone}
            </a>
          )}
        </section>

        {entry.appointment && (
          <section className={`${wl.linked} ${entry.appointment.status === "pending" ? wl.warn : ""}`} aria-label="Cita vinculada">
            <span className={wl.offerTitle}>
              Cita vinculada{entry.appointment.startsAt ? `: ${when(entry.appointment.startsAt)}` : ""}
            </span>
            {entry.appointment.status === "pending" && <span className={wl.offerText}>{BOOK_PENDING_TEXT}</span>}
            <Link href={`/appointments/${entry.appointment.id}`} className={wl.agendaLink}>
              Ver la cita
            </Link>
          </section>
        )}

        <div className={styles.twoCols}>
          <div className={wl.stack}>
            {entry.offer && (
              <>
                <WaitlistOfferPanel organizationId={org.id} entryId={entry.id} offer={entry.offer} />
                {entry.offer.professionalId && (
                  <Link
                    href={`/waitlist/${entry.id}/book?pro=${encodeURIComponent(entry.offer.professionalId)}&at=${encodeURIComponent(entry.offer.startsAt)}`}
                    className={wl.agendaLink}
                  >
                    Reservar el hueco ofrecido
                  </Link>
                )}
              </>
            )}

            <section className={wl.section} aria-label="Huecos compatibles">
              <h2 className={wl.sectionTitle}>Huecos compatibles (14 días)</h2>
              {canSearchSlots && slots?.ok ? (
                <WaitlistSlots organizationId={org.id} entryId={entry.id} slots={slots.slots} hasPendingOffer={!!entry.offer} />
              ) : canSearchSlots ? (
                <p className={wl.hint}>No se han podido cargar los huecos. Inténtalo de nuevo en unos minutos.</p>
              ) : entry.appointment ? (
                <p className={wl.hint}>La entrada ya tiene una cita vinculada.</p>
              ) : entry.status === "contacted" ? (
                <p className={wl.hint}>Vuelve a poner la entrada en cola para consultar huecos compatibles.</p>
              ) : (
                <p className={wl.hint}>Esta entrada ya no está en la cola.</p>
              )}
            </section>
          </div>

          <WaitlistEntryManager organizationId={org.id} entry={entry} professionals={catalog.professionals} />
        </div>
      </div>
    </AppShell>
  );
}

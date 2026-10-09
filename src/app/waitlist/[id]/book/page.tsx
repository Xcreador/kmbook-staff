import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { getDepositQuote, getWaitlistEntry } from "@/lib/kmbook/waitlist";
import { UUID_PATTERN } from "@/lib/kmbook/waitlist-format";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { TrustBadge } from "@/components/TrustBadge";
import { WaitlistBookForm } from "@/components/WaitlistBookForm";
import { LockIcon } from "@/components/Icons";
import wl from "@/components/Waitlist.module.css";
import styles from "../../waitlist.module.css";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pro?: string; at?: string }>;
}

export default async function BookWaitlistEntryPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { pro, at } = await searchParams;
  if (!UUID_PATTERN.test(id) || !pro || !UUID_PATTERN.test(pro) || !at || Number.isNaN(Date.parse(at))) notFound();

  const viewer = await getStaffViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.activeOrganization) redirect("/select-organization");
  const org = viewer.activeOrganization;

  const [{ access, entry }, unreadCount, settings] = await Promise.all([
    getWaitlistEntry(org.id, id),
    getUnreadNotificationCount(org.id),
    getOrganizationSettings(org.id),
  ]);

  const shell = {
    title: "Reservar",
    organizationName: org.name,
    userName: viewer.profile?.displayName,
    avatarUrl: viewer.profile?.avatarUrl,
    unreadCount,
    timeClockEnabled: settings.staffIndividualTimeClockEnabled,
    showBack: true,
    backHref: `/waitlist/${id}`,
  };

  if (access !== "ok") {
    return (
      <AppShell {...shell}>
        <EmptyState
          icon={<LockIcon size={24} color="var(--km-gray)" />}
          title={access === "forbidden" ? "No tienes acceso" : "Lista de espera no disponible"}
          description={access === "forbidden" ? "Tu perfil no incluye la gestión de la lista de espera." : "Inténtalo de nuevo en unos minutos."}
          action={<Link href="/agenda" className={wl.agendaLink}>Volver a la agenda</Link>}
        />
      </AppShell>
    );
  }
  if (!entry) notFound();

  if (entry.status !== "active" && entry.status !== "contacted") {
    return (
      <AppShell {...shell}>
        <EmptyState title="Esta entrada ya no está en la cola" description="No se puede crear una reserva desde ella." action={<Link href="/waitlist" className={wl.agendaLink}>Volver a la lista</Link>} />
      </AppShell>
    );
  }

  const quote = await getDepositQuote(org.id, entry.clientId, entry.serviceId);
  const when = new Date(at).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <AppShell {...shell}>
      <div className={styles.page}>
        <section className={styles.detailCard} aria-label="Resumen de la reserva">
          <div className={wl.name}>{entry.clientName}</div>
          <div className={wl.service}>{entry.serviceName}</div>
          <div className={wl.offerText} style={{ textTransform: "capitalize" }}>{when}</div>
          {/* El color sólo si Core lo devuelve (trust.view): el presupuesto ya viene filtrado. */}
          {quote?.color && <TrustBadge color={quote.color} />}
        </section>
        <WaitlistBookForm
          organizationId={org.id}
          entryId={entry.id}
          clientId={entry.clientId}
          serviceId={entry.serviceId}
          professionalId={pro}
          startsAt={at}
          quote={quote}
        />
      </div>
    </AppShell>
  );
}

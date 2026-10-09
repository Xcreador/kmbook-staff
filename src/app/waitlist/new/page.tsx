import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { getWaitlistBoard, getWaitlistCatalog } from "@/lib/kmbook/waitlist";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { WaitlistAddForm } from "@/components/WaitlistAddForm";
import { LockIcon } from "@/components/Icons";
import wl from "@/components/Waitlist.module.css";
import styles from "../waitlist.module.css";

export default async function NewWaitlistEntryPage() {
  const viewer = await getStaffViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.activeOrganization) redirect("/select-organization");
  const org = viewer.activeOrganization;

  const [access, catalog, unreadCount, settings] = await Promise.all([
    getWaitlistBoard(org.id, "active"),
    getWaitlistCatalog(org.id),
    getUnreadNotificationCount(org.id),
    getOrganizationSettings(org.id),
  ]);

  return (
    <AppShell
      title="Añadir a la lista"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
      showBack
      backHref="/waitlist"
    >
      <div className={styles.page}>
        {access.access !== "ok" ? (
          <EmptyState
            icon={<LockIcon size={24} color="var(--km-gray)" />}
            title="No tienes acceso"
            description="Tu perfil no incluye la gestión de la lista de espera."
            action={<Link href="/agenda" className={wl.agendaLink}>Volver a la agenda</Link>}
          />
        ) : (
          <WaitlistAddForm organizationId={org.id} services={catalog.services} professionals={catalog.professionals} />
        )}
      </div>
    </AppShell>
  );
}

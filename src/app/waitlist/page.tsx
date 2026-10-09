import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings } from "@/lib/kmbook/organization-settings";
import { getWaitlistBoard } from "@/lib/kmbook/waitlist";
import { WAITLIST_FILTERS, parseFilter } from "@/lib/kmbook/waitlist-format";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { WaitlistCard } from "@/components/WaitlistCard";
import { HourglassIcon, LockIcon, PlusIcon } from "@/components/Icons";
import wl from "@/components/Waitlist.module.css";
import styles from "./waitlist.module.css";

interface WaitlistPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function WaitlistPage({ searchParams }: WaitlistPageProps) {
  const { status } = await searchParams;
  const viewer = await getStaffViewerContext();
  if (!viewer) redirect("/login");
  if (!viewer.activeOrganization) redirect("/select-organization");

  const org = viewer.activeOrganization;
  const filter = parseFilter(status);

  const [board, unreadCount, settings] = await Promise.all([
    getWaitlistBoard(org.id, filter),
    getUnreadNotificationCount(org.id),
    getOrganizationSettings(org.id),
  ]);

  return (
    <AppShell
      title="Lista de espera"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
      showBack
      backHref="/agenda"
    >
      <div className={styles.page}>
        {board.access === "forbidden" ? (
          <EmptyState
            icon={<LockIcon size={24} color="var(--km-gray)" />}
            title="No tienes acceso"
            description="Tu perfil no incluye la gestión de la lista de espera. Pídeselo a la persona propietaria del centro."
            action={<Link href="/agenda" className={wl.agendaLink}>Volver a la agenda</Link>}
          />
        ) : board.access === "unavailable" ? (
          <EmptyState
            icon={<HourglassIcon size={24} color="var(--km-gray)" />}
            title="Lista de espera no disponible"
            description="No se ha podido cargar la lista de espera. Inténtalo de nuevo en unos minutos."
            action={<Link href="/waitlist" className={wl.agendaLink}>Reintentar</Link>}
          />
        ) : (
          <>
            <div className={wl.toolbar}>
              <nav className={wl.filters} aria-label="Filtrar por estado">
                {WAITLIST_FILTERS.map((f) => (
                  <Link
                    key={f.value}
                    href={f.value === "all" ? "/waitlist" : `/waitlist?status=${f.value}`}
                    className={`${wl.chip} ${filter === f.value ? wl.chipActive : ""}`}
                    aria-current={filter === f.value ? "page" : undefined}
                  >
                    {f.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className={styles.backRow}>
              <Link href="/waitlist/new" className={wl.agendaLink}>
                <PlusIcon size={14} />
                Añadir clienta
              </Link>
            </div>

            {board.entries.length === 0 ? (
              <EmptyState
                icon={<HourglassIcon size={24} color="var(--km-gray)" />}
                title={filter === "all" ? "Nadie en la lista de espera" : "Sin entradas en este estado"}
                description={
                  filter === "all"
                    ? "Cuando una clienta no encuentre hueco, añádela aquí. Core te avisará cuando se libere uno compatible."
                    : "Prueba con otro filtro para ver el resto de entradas."
                }
              />
            ) : (
              <div className={wl.boardGrid}>
                {board.entries.map((entry) => (
                  <WaitlistCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffViewerContext, clearActiveOrganization, logout } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings, STAFF_TIME_CLOCK_BLOCKED } from "@/lib/kmbook/organization-settings";
import { AppShell } from "@/components/AppShell";
import {
  UserIcon,
  BuildingIcon,
  CalendarIcon,
  LogOutIcon,
  RefreshCwIcon,
  MapPinIcon,
  ExternalLinkIcon,
} from "@/components/Icons";
import { Button } from "@/components/Button";
import styles from "./profile.module.css";

export default async function ProfilePage() {
  const viewer = await getStaffViewerContext();
  if (!viewer) {
    redirect("/login");
  }

  const org = viewer.activeOrganization;
  const unreadCount = org ? await getUnreadNotificationCount(org.id) : 0;
  const settings = org
    ? await getOrganizationSettings(org.id)
    : STAFF_TIME_CLOCK_BLOCKED;

  const handleSwitchOrg = async () => {
    "use server";
    await clearActiveOrganization();
    redirect("/select-organization");
  };

  const handleLogout = async () => {
    "use server";
    await logout();
  };

  const roleLabel =
    org?.role === "owner"
      ? "Propietario"
      : org?.role === "manager"
      ? "Encargado / Manager"
      : org?.role === "reception"
      ? "Recepción"
      : "Profesional";

  return (
    <AppShell
      title="Mi perfil"
      showBack={true}
      backHref="/today"
      organizationName={org?.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled={settings.staffIndividualTimeClockEnabled}
    >
      <div className={styles.container}>
        {/* Cabecera del usuario */}
        <section className={styles.userCard}>
          <div className={styles.avatarWrapper}>
            {viewer.profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewer.profile.avatarUrl}
                alt={viewer.profile.displayName}
                className={styles.avatarLarge}
              />
            ) : (
              <div className={styles.avatarPlaceholderLarge}>
                <UserIcon size={36} color="var(--km-oxford)" />
              </div>
            )}
          </div>

          <div className={styles.userMeta}>
            <h2 className={styles.userName}>{viewer.profile?.displayName || "Profesional"}</h2>
            <span className={styles.userEmail}>{viewer.user.email}</span>
            <span className={styles.roleBadge}>{roleLabel}</span>
          </div>
        </section>

        {/* Organización y Centros */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>NEGOCIO ACTUAL</h3>
          </div>

          <div className={styles.orgRow}>
            <div className={styles.orgInfo}>
              <div className={styles.orgIconBox}>
                <BuildingIcon size={20} color="var(--km-oxford)" />
              </div>
              <div className={styles.orgTexts}>
                <span className={styles.orgName}>{org?.name || "KMBOOK"}</span>
                <span className={styles.orgCentres}>
                  <MapPinIcon size={12} color="var(--km-gray)" />
                  {viewer.locations.length} {viewer.locations.length === 1 ? "centro" : "centros"}
                </span>
              </div>
            </div>

            {viewer.organizations.length > 1 && (
              <form action={handleSwitchOrg}>
                <button type="submit" className={styles.switchOrgBtn}>
                  <RefreshCwIcon size={14} color="var(--km-pink)" />
                  <span>Cambiar negocio</span>
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Acceso rápido a Mi Horario */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>PLANIFICACIÓN Y AUSENCIAS</h3>
          </div>

          <Link href="/schedule" className={styles.actionRow}>
            <div className={styles.actionLeft}>
              <CalendarIcon size={20} color="var(--km-oxford)" />
              <div className={styles.actionTexts}>
                <span className={styles.actionTitle}>Ver mi horario semanal</span>
                <span className={styles.actionDesc}>Turnos planificados, pausas y festivos</span>
              </div>
            </div>
            <span className={styles.actionArrow}>→</span>
          </Link>
        </section>

        {/* Acceso opcional a KMBOOK Studio / TPV para recepción/owners (Regla 35) */}
        {(org?.role === "reception" || org?.role === "manager" || org?.role === "owner") && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>KMBOOK STUDIO</h3>
            </div>
            <a
              href={`${process.env.NEXT_PUBLIC_BUSINESS_URL || "https://app.kmbook.es"}/app/studio/pos`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionRow}
            >
              <div className={styles.actionLeft}>
                <ExternalLinkIcon size={20} color="var(--km-pink)" />
                <div className={styles.actionTexts}>
                  <span className={styles.actionTitle}>Abrir KMBOOK Studio / TPV</span>
                  <span className={styles.actionDesc}>Acceso web a caja y administración completa</span>
                </div>
              </div>
              <span className={styles.actionArrow}>↗</span>
            </a>
          </section>
        )}

        {/* Info App & PWA */}
        <section className={styles.appInfoCard}>
          <div className={styles.infoRow}>
            <span className={styles.infoKey}>Versión instalada:</span>
            <span className={styles.infoVal}>KMBOOK Staff v1.0.0 (PWA)</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoKey}>Diseño:</span>
            <span className={styles.infoVal}>KMBOOK V10 Mobile First</span>
          </div>
        </section>

        {/* Botón de Cerrar Sesión */}
        <div className={styles.logoutWrapper}>
          <form action={handleLogout}>
            <Button
              type="submit"
              variant="danger"
              size="lg"
              fullWidth
              icon={<LogOutIcon size={18} color="var(--status-cancelled)" />}
            >
              Cerrar sesión
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

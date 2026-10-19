import { redirect } from "next/navigation";
import { getStaffViewerContext, clearActiveOrganization, logout } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getOrganizationSettings, STAFF_TIME_CLOCK_BLOCKED } from "@/lib/kmbook/organization-settings";
import { AppShell } from "@/components/AppShell";
import {
  BuildingIcon,
  LogOutIcon,
  RefreshCwIcon,
  MapPinIcon,
} from "@/components/Icons";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { BusinessAccessCard } from "@/components/BusinessAccessCard";
import { getStudioAccess, NO_STUDIO_ACCESS } from "@/lib/kmbook/studio-access";
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

  const studioAccess = org ? await getStudioAccess(org.id) : NO_STUDIO_ACCESS;

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
            <Avatar
              src={viewer.profile?.avatarUrl}
              name={viewer.profile?.displayName ?? "Profesional"}
              size={64}
              className={styles.avatarLarge}
              placeholderClassName={styles.avatarPlaceholderLarge}
            />
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

        {/* Accesos a Business: solo con permiso expreso de Core, nunca por rol. */}
        <BusinessAccessCard access={studioAccess} />

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

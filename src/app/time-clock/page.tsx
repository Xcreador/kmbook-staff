import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffViewerContext } from "@/lib/kmbook/auth";
import { getUnreadNotificationCount } from "@/lib/kmbook/notifications";
import { getStaffTimeClockAccess } from "@/lib/kmbook/staff-time-clock-access";
import {
  StaffTimeClockAdapter,
  TIME_CLOCK_UNAVAILABLE_TITLE,
  timeClockUnavailableMessage,
} from "@/lib/kmbook/time-clock";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ClockIcon } from "@/components/Icons";
import { TimeClockView } from "@/components/TimeClockView";
import buttonStyles from "@/components/Button.module.css";

export const dynamic = "force-dynamic";

export default async function TimeClockPage() {
  const access = await getStaffTimeClockAccess();

  if (!access.allowed) {
    if (access.reason === "session") redirect("/login");
    if (access.reason === "organization") redirect("/select-organization");

    // Ajuste desactivado o no legible: estado claro, sin controles ni datos de
    // fichaje. La URL directa no sirve para fichar (las acciones también lo
    // bloquean en servidor).
    const viewer = await getStaffViewerContext().catch(() => null);
    const org = viewer?.activeOrganization ?? null;
    const unreadCount = org ? await getUnreadNotificationCount(org.id).catch(() => 0) : 0;

    return (
      <AppShell
        title="Fichaje"
        organizationName={org?.name}
        userName={viewer?.profile?.displayName}
        avatarUrl={viewer?.profile?.avatarUrl}
        unreadCount={unreadCount}
        timeClockEnabled={false}
      >
        <div data-testid="time-clock-unavailable">
          <EmptyState
            icon={<ClockIcon size={24} color="var(--km-oxford)" />}
            title={TIME_CLOCK_UNAVAILABLE_TITLE}
            description={timeClockUnavailableMessage(access.reason)}
            action={
              <Link className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.md}`} href="/today">
                Volver a Mi jornada
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const { viewer, organization: org } = access;
  const supabase = await createClient();

  const [unreadCount, initialShift, initialHistory, locations] = await Promise.all([
    getUnreadNotificationCount(org.id),
    StaffTimeClockAdapter.getTodaySession(org.id, viewer.user.id, supabase, org.timezone),
    StaffTimeClockAdapter.getHistory(org.id, viewer.user.id, supabase),
    StaffTimeClockAdapter.getActiveLocations(org.id, supabase),
  ]);

  return (
    <AppShell
      title="Fichaje"
      organizationName={org.name}
      userName={viewer.profile?.displayName}
      avatarUrl={viewer.profile?.avatarUrl}
      unreadCount={unreadCount}
      timeClockEnabled
    >
      {/* key: al cambiar de organización se monta de cero, sin estado residual. */}
      <TimeClockView
        key={org.id}
        organizationId={org.id}
        userId={viewer.user.id}
        initialShift={initialShift}
        initialHistory={initialHistory}
        locations={locations}
      />
    </AppShell>
  );
}

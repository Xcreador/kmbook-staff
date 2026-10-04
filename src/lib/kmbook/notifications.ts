import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StaffNotification = {
  id: number;
  eventType: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  isRead: boolean;
  appointmentId?: string;
};

export type NotificationsContext = {
  organizationId: string;
  unreadCount: number;
  notifications: StaffNotification[];
};

/**
 * Carga las notificaciones reales del profesional desde KMBOOK Core.
 * Regla 27 & 29: Sin badges falsos ni motor paralelo.
 */
export async function getNotificationsContext(
  organizationId: string,
  limit: number = 50,
  unreadOnly: boolean = false,
): Promise<NotificationsContext> {
  const supabase = await createClient();

  const [inboxRes, countRes] = await Promise.all([
    supabase.rpc("get_my_notifications", {
      p_organization_id: organizationId,
      p_limit: limit,
      p_unread_only: unreadOnly,
    }),
    supabase.rpc("count_my_unread_notifications", {
      p_organization_id: organizationId,
    }),
  ]);

  const rawRows = inboxRes.data ?? [];
  const unreadCount = typeof countRes.data === "number" ? countRes.data : 0;

  const notifications: StaffNotification[] = rawRows.map((row) => {
    const dataObj = typeof row.data === "object" && row.data !== null ? (row.data as Record<string, unknown>) : {};
    const appointmentId = typeof dataObj.appointment_id === "string" ? dataObj.appointment_id : undefined;

    return {
      id: row.delivery_id,
      eventType: row.event_type,
      title: row.title,
      body: row.body,
      data: dataObj,
      readAt: row.read_at,
      createdAt: row.created_at,
      isRead: !!row.read_at,
      appointmentId,
    };
  });

  return {
    organizationId,
    unreadCount,
    notifications,
  };
}

/**
 * Obtiene el conteo de no leídas para el badge del Bottom Nav.
 */
export async function getUnreadNotificationCount(organizationId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("count_my_unread_notifications", {
      p_organization_id: organizationId,
    });
    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}

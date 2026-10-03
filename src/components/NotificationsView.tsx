"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";
import type { StaffNotification } from "@/lib/kmbook/notifications";
import { BellIcon, CheckIcon, ArrowRightIcon } from "./Icons";
import { EmptyState } from "./EmptyState";
import styles from "./NotificationsView.module.css";

interface NotificationsViewProps {
  organizationId: string;
  initialNotifications: StaffNotification[];
  initialUnreadCount: number;
}

export function NotificationsView({
  organizationId,
  initialNotifications,
  initialUnreadCount,
}: NotificationsViewProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);

  const handleMarkAsRead = async (id: number) => {
    // Actualización optimista
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    await markNotificationReadAction(organizationId, id);
    router.refresh();
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);

    await markAllNotificationsReadAction(organizationId);
    setLoading(false);
    router.refresh();
  };

  const [mountedTime] = useState(() => Date.now());

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = mountedTime - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "Ahora mismo";
      if (diffMins < 60) return `Hace ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.topActions}>
        <span className={styles.unreadTag}>
          {unreadCount === 0 ? "Sin avisos pendientes" : `${unreadCount} pendientes`}
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            className={styles.markAllBtn}
            onClick={handleMarkAllRead}
            disabled={loading}
          >
            <CheckIcon size={14} color="var(--km-pink)" />
            <span>Marcar todas como leídas</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon size={24} color="var(--km-gray)" />}
          title="Bandeja de avisos vacía"
          description="Aquí recibirás los avisos de nuevas citas asignadas, cambios de horario y cancelaciones."
        />
      ) : (
        <div className={styles.list}>
          {notifications.map((item) => {
            const hasLink = !!item.appointmentId;

            return (
              <div
                key={item.id}
                className={`${styles.card} ${!item.isRead ? styles.unreadCard : ""}`}
                onClick={() => {
                  if (!item.isRead) handleMarkAsRead(item.id);
                }}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.titleRow}>
                    {!item.isRead && <span className={styles.unreadDot} />}
                    <h3 className={styles.itemTitle}>{item.title}</h3>
                  </div>
                  <span className={styles.timeTag}>{formatRelativeTime(item.createdAt)}</span>
                </div>

                <p className={styles.itemBody}>{item.body}</p>

                {hasLink && (
                  <div className={styles.cardFooter}>
                    <Link
                      href={`/appointments/${item.appointmentId}`}
                      className={styles.deepLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>Abrir cita</span>
                      <ArrowRightIcon size={14} color="var(--km-pink)" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

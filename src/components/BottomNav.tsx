"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparklesIcon, CalendarIcon, ClockIcon, BellIcon } from "./Icons";
import styles from "./BottomNav.module.css";

interface BottomNavProps {
  unreadCount?: number;
}

export function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();

  const isToday = pathname === "/today" || pathname === "/";
  const isAgenda = pathname.startsWith("/agenda");
  const isTimeClock = pathname.startsWith("/time-clock");
  const isNotifications = pathname.startsWith("/notifications");

  return (
    <nav className={styles.bottomNav} aria-label="Navegación principal">
      <div className={styles.navContainer}>
        <Link
          href="/today"
          className={`${styles.navItem} ${isToday ? styles.active : ""}`}
          aria-current={isToday ? "page" : undefined}
        >
          <div className={styles.iconWrapper}>
            <SparklesIcon size={22} color={isToday ? "var(--km-pink)" : "var(--km-oxford)"} />
          </div>
          <span className={styles.label}>HOY</span>
        </Link>

        <Link
          href="/agenda"
          className={`${styles.navItem} ${isAgenda ? styles.active : ""}`}
          aria-current={isAgenda ? "page" : undefined}
        >
          <div className={styles.iconWrapper}>
            <CalendarIcon size={22} color={isAgenda ? "var(--km-pink)" : "var(--km-oxford)"} />
          </div>
          <span className={styles.label}>AGENDA</span>
        </Link>

        <Link
          href="/time-clock"
          className={`${styles.navItem} ${isTimeClock ? styles.active : ""}`}
          aria-current={isTimeClock ? "page" : undefined}
        >
          <div className={styles.iconWrapper}>
            <ClockIcon size={22} color={isTimeClock ? "var(--km-pink)" : "var(--km-oxford)"} />
          </div>
          <span className={styles.label}>FICHAJE</span>
        </Link>

        <Link
          href="/notifications"
          className={`${styles.navItem} ${isNotifications ? styles.active : ""}`}
          aria-current={isNotifications ? "page" : undefined}
        >
          <div className={styles.iconWrapper}>
            <BellIcon size={22} color={isNotifications ? "var(--km-pink)" : "var(--km-oxford)"} />
            {unreadCount > 0 && (
              <span className={styles.badge} aria-label={`${unreadCount} avisos no leídos`}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <span className={styles.label}>AVISOS</span>
        </Link>
      </div>
    </nav>
  );
}

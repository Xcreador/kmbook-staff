"use client";

import React, { useEffect } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "./OfflineBanner";
import { registerServiceWorker } from "@/lib/kmbook/push";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: React.ReactNode;
  organizationName?: string;
  userName?: string;
  avatarUrl?: string | null;
  unreadCount?: number;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  hideNav?: boolean;
}

export function AppShell({
  children,
  organizationName,
  userName,
  avatarUrl,
  unreadCount = 0,
  title,
  showBack,
  backHref,
  hideNav = false,
}: AppShellProps) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <div className={styles.shell}>
      <OfflineBanner />
      <TopBar
        title={title}
        organizationName={organizationName}
        userName={userName}
        avatarUrl={avatarUrl}
        showBack={showBack}
        backHref={backHref}
      />
      <main className={`${styles.main} ${hideNav ? styles.noNav : ""}`}>
        <div className={styles.container}>{children}</div>
      </main>
      {!hideNav && <BottomNav unreadCount={unreadCount} />}
    </div>
  );
}

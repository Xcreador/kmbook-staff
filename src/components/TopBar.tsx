"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, UserIcon } from "./Icons";
import { BrandMark } from "./BrandMark";
import styles from "./TopBar.module.css";

interface TopBarProps {
  title?: string;
  organizationName?: string;
  avatarUrl?: string | null;
  userName?: string;
  showBack?: boolean;
  backHref?: string;
}

export function TopBar({
  title,
  organizationName,
  avatarUrl,
  userName = "Staff",
  showBack = false,
  backHref,
}: TopBarProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className={styles.topBar}>
      <div className={styles.container}>
        <div className={styles.left}>
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              className={styles.backButton}
              aria-label="Volver atrás"
            >
              <ArrowLeftIcon size={20} color="var(--km-oxford)" />
            </button>
          ) : (
            <Link href="/today" className={styles.logoLink} aria-label="Ir a Hoy">
              <BrandMark size={28} />
            </Link>
          )}

          <div className={styles.titles}>
            {title ? (
              <h1 className={styles.pageTitle}>{title}</h1>
            ) : (
              <div className={styles.orgBadge}>
                <span className={styles.orgName}>{organizationName || "KMBOOK"}</span>
                <span className={styles.staffTag}>STAFF</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.right}>
          <Link href="/profile" className={styles.profileLink} aria-label="Ver perfil de usuario">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={userName} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatarPlaceholder} title={userName}>
                <UserIcon size={16} color="var(--km-oxford)" />
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

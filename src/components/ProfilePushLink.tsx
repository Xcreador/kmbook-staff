import Link from "next/link";

import { BellIcon } from "@/components/Icons";
import styles from "./ProfilePushLink.module.css";

/** Acceso desde Perfil a «Notificaciones en este dispositivo» (Push V1). */
export function ProfilePushLink() {
  return (
    <Link href="/profile/push" className={styles.row} data-testid="profile-push-link">
      <span className={styles.left}>
        <BellIcon size={20} color="var(--km-oxford)" />
        <span className={styles.texts}>
          <span className={styles.title}>Notificaciones en este dispositivo</span>
          <span className={styles.desc}>Citas asignadas, cambios y tareas</span>
        </span>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

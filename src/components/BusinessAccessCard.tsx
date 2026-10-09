import { ExternalLinkIcon } from "./Icons";
import type { StudioAccess } from "@/lib/kmbook/studio-access";
import styles from "@/app/profile/profile.module.css";

/**
 * Accesos opcionales a KMBOOK Business. Cada uno aparece solo si Core concede el
 * permiso expreso de su módulo destino (ver `studio-access.ts`). El TPV nunca
 * implica el acceso de gestión. Un enlace oculto no autoriza nada: Core
 * revalida al llegar a Business.
 */
export function BusinessAccessCard({ access }: { access: StudioAccess }) {
  if (!access.tpv && !access.admin) return null;

  return (
    <section className={styles.card} data-testid="business-access">
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>KMBOOK BUSINESS</h3>
      </div>
      {access.tpv && (
        <a
          href={access.tpv.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.actionRow}
          data-testid="business-access-tpv"
        >
          <div className={styles.actionLeft}>
            <ExternalLinkIcon size={20} color="var(--km-pink)" />
            <div className={styles.actionTexts}>
              <span className={styles.actionTitle}>Abrir TPV</span>
              <span className={styles.actionDesc}>Cobros y caja en KMBOOK Business. Solo el TPV.</span>
            </div>
          </div>
          <span className={styles.actionArrow}>↗</span>
        </a>
      )}
      {access.admin && (
        <a
          href={access.admin.href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.actionRow}
          data-testid="business-access-admin"
        >
          <div className={styles.actionLeft}>
            <ExternalLinkIcon size={20} color="var(--km-pink)" />
            <div className={styles.actionTexts}>
              <span className={styles.actionTitle}>Abrir KMBOOK Business</span>
              <span className={styles.actionDesc}>Gestión administrativa: equipo, servicios y permisos</span>
            </div>
          </div>
          <span className={styles.actionArrow}>↗</span>
        </a>
      )}
    </section>
  );
}

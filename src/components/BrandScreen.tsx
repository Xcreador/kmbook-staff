import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import styles from "./BrandScreen.module.css";

interface BrandScreenProps {
  title: string;
  message?: string;
  children?: ReactNode;
  role?: "alert" | "status";
}

/** Pantalla completa con la marca KMBOOK Staff: errores globales y página no encontrada. */
export function BrandScreen({ title, message, children, role = "status" }: BrandScreenProps) {
  return (
    <main className={styles.screen} role={role}>
      <BrandMark size={56} priority />
      <p className={styles.product}>KMBOOK Staff</p>
      <h1 className={styles.title}>{title}</h1>
      {message && <p className={styles.message}>{message}</p>}
      {children}
    </main>
  );
}

import Link from "next/link";
import { BrandScreen } from "@/components/BrandScreen";
import styles from "@/components/BrandScreen.module.css";

export default function NotFound() {
  return (
    <BrandScreen title="Página no encontrada" message="La página que buscas no existe o ya no está disponible.">
      <Link href="/today" className={styles.link}>Volver a Hoy</Link>
    </BrandScreen>
  );
}

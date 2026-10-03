import React from "react";
import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({ width = "100%", height = "20px", borderRadius = "8px", className }: SkeletonProps) {
  const style = {
    width,
    height,
    borderRadius,
  };

  return <div className={`${styles.skeleton} ${className || ""}`} style={style} aria-hidden="true" />;
}

export function AppointmentCardSkeleton() {
  return (
    <div className={styles.cardSkeleton} aria-busy="true" aria-label="Cargando cita...">
      <div className={styles.rowBetween}>
        <Skeleton width="120px" height="24px" />
        <Skeleton width="70px" height="22px" borderRadius="999px" />
      </div>
      <div className={styles.colGap}>
        <Skeleton width="65%" height="20px" />
        <Skeleton width="85%" height="16px" />
      </div>
      <Skeleton width="100%" height="16px" />
    </div>
  );
}

export function TodayPageSkeleton() {
  return (
    <div className={styles.pageSkeleton} aria-busy="true" aria-label="Cargando tu jornada...">
      <Skeleton width="180px" height="28px" />
      <Skeleton width="130px" height="18px" />
      <div style={{ height: "16px" }} />
      <Skeleton width="100%" height="160px" borderRadius="18px" />
      <div style={{ height: "16px" }} />
      <Skeleton width="140px" height="22px" />
      <AppointmentCardSkeleton />
      <AppointmentCardSkeleton />
    </div>
  );
}

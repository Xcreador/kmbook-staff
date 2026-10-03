import React from "react";
import { AlertCircleIcon, RefreshCwIcon } from "./Icons";
import { Button } from "./Button";
import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Ha ocurrido un problema al cargar los datos. Comprueba tu conexión.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={styles.errorContainer} role="alert">
      <div className={styles.iconCircle}>
        <AlertCircleIcon size={26} color="var(--status-cancelled)" />
      </div>
      <h3 className={styles.title}>No se pudo cargar la información</h3>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCwIcon size={16} />}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

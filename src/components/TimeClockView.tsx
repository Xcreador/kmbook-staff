"use client";

import React, { useState } from "react";
import { TimeClockCard } from "./TimeClockCard";
import { StaffTimeClockAdapter } from "@/lib/kmbook/time-clock";
import { ClockIcon, CalendarIcon } from "./Icons";
import styles from "./TimeClockView.module.css";

interface TimeClockViewProps {
  organizationId: string;
  userId: string;
}

export function TimeClockView({ organizationId, userId }: TimeClockViewProps) {
  const [tab, setTab] = useState<"today" | "history">("today");
  const history = StaffTimeClockAdapter.getHistory();

  return (
    <div className={styles.wrapper}>
      {/* Selector de Pestañas: HOY / HISTORIAL */}
      <div className={styles.tabsBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === "today" ? styles.tabActive : ""}`}
          onClick={() => setTab("today")}
        >
          <ClockIcon size={16} color={tab === "today" ? "var(--km-pink)" : "var(--km-gray)"} />
          <span>HOY</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === "history" ? styles.tabActive : ""}`}
          onClick={() => setTab("history")}
        >
          <CalendarIcon size={16} color={tab === "history" ? "var(--km-pink)" : "var(--km-gray)"} />
          <span>HISTORIAL</span>
        </button>
      </div>

      {tab === "today" ? (
        <div className={styles.tabContent}>
          <div className={styles.introHeader}>
            <h2 className={styles.title}>Registro de jornada</h2>
            <p className={styles.subtitle}>
              Registra tus entradas, salidas y descansos con un solo toque desde tu teléfono.
            </p>
          </div>

          <TimeClockCard organizationId={organizationId} userId={userId} />

          <div className={styles.infoBanner}>
            <span className={styles.infoTitle}>Normativa de registro de jornada</span>
            <p className={styles.infoText}>
              Este registro refleja únicamente el tiempo efectivo de trabajo y descansos de tu jornada.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.tabContent}>
          <div className={styles.introHeader}>
            <h2 className={styles.title}>Mis jornadas anteriores</h2>
            <p className={styles.subtitle}>Historial personal de los últimos días de trabajo.</p>
          </div>

          <div className={styles.historyList}>
            {history.map((entry, index) => (
              <div key={index} className={styles.historyCard}>
                <div className={styles.historyTop}>
                  <span className={styles.historyDate}>{entry.formattedDate}</span>
                  <span className={styles.historyTotal}>{entry.totalWorked}</span>
                </div>

                <div className={styles.historyDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Horario real:</span>
                    <span className={styles.detailValue}>
                      {entry.clockIn} → {entry.clockOut}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Pausas:</span>
                    <span className={styles.detailValue}>{entry.totalBreaks}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

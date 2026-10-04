"use client";

import React, { useState } from "react";
import { TimeClockCard } from "./TimeClockCard";
import {
  StaffTimeClockAdapter,
  type TimeClockShift,
  type ShiftHistoryEntry,
} from "@/lib/kmbook/time-clock";
import { ClockIcon, CalendarIcon } from "./Icons";
import { EmptyState } from "./EmptyState";
import styles from "./TimeClockView.module.css";

interface LocationItem {
  id: string;
  name: string;
  timezone?: string;
}

interface TimeClockViewProps {
  organizationId: string;
  userId: string;
  initialShift?: TimeClockShift;
  initialHistory?: ShiftHistoryEntry[];
  locations?: LocationItem[];
}

export function TimeClockView({
  organizationId,
  userId,
  initialShift,
  initialHistory,
  locations = [],
}: TimeClockViewProps) {
  const [tab, setTab] = useState<"today" | "history">("today");
  const [currentShift, setCurrentShift] = useState<TimeClockShift | undefined>(initialShift);
  const [history, setHistory] = useState<ShiftHistoryEntry[]>(initialHistory ?? []);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Si hay exactamente 1 centro, se selecciona automáticamente. Si hay varios, el primero por defecto.
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
    if (initialShift?.locationId) return initialShift.locationId;
    if (locations.length > 0) return locations[0].id;
    return null;
  });

  const handleTabChange = (newTab: "today" | "history") => {
    setTab(newTab);
    if (newTab === "history" && !initialHistory && history.length === 0) {
      setLoadingHistory(true);
      StaffTimeClockAdapter.getHistory(organizationId, userId)
        .then((data) => setHistory(data))
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Selector de Pestañas: HOY / HISTORIAL */}
      <div className={styles.tabsBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "today"}
          className={`${styles.tabBtn} ${tab === "today" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("today")}
        >
          <ClockIcon size={16} color={tab === "today" ? "var(--km-pink)" : "var(--km-gray)"} />
          <span>HOY</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={`${styles.tabBtn} ${tab === "history" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("history")}
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

          {/* Selector de centro si la organización cuenta con múltiples sedes activas */}
          {locations.length > 1 && (
            <div className={styles.locationBox}>
              <label htmlFor="locationSelect" className={styles.locationLabel}>
                Centro de trabajo
              </label>
              <select
                id="locationSelect"
                className={styles.locationSelect}
                value={selectedLocationId ?? ""}
                onChange={(e) => setSelectedLocationId(e.target.value || null)}
                disabled={currentShift?.state === "TRABAJANDO" || currentShift?.state === "EN_PAUSA"}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <TimeClockCard
            organizationId={organizationId}
            userId={userId}
            locationId={selectedLocationId}
            initialShift={currentShift}
            onShiftChange={setCurrentShift}
          />

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

          {loadingHistory ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--km-gray)", fontSize: "0.85rem" }}>
              Cargando historial de jornadas...
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              title="Sin jornadas registradas"
              description="Aún no tienes registros de jornadas finalizadas en esta organización."
            />
          ) : (
            <div className={styles.historyList}>
              {history.map((entry) => (
                <div key={entry.id} className={styles.historyCard}>
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
          )}
        </div>
      )}
    </div>
  );
}

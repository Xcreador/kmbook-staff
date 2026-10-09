"use client";

import React from "react";
import { NOTES_MAX, WEEKDAYS } from "@/lib/kmbook/waitlist-format";
import type { CatalogItem } from "@/lib/kmbook/waitlist";
import styles from "./Waitlist.module.css";

export type PreferencesState = {
  professionalId: string;
  days: number[];
  timeFrom: string;
  timeTo: string;
  notes: string;
};

interface Props {
  value: PreferencesState;
  onChange: (next: PreferencesState) => void;
  professionals: CatalogItem[];
  idPrefix: string;
}

/** Campos de preferencias (profesional, días, franja, notas). Sin reglas: Core valida. */
export function WaitlistPreferencesFields({ value, onChange, professionals, idPrefix }: Props) {
  const set = (patch: Partial<PreferencesState>) => onChange({ ...value, ...patch });
  const toggleDay = (d: number) =>
    set({ days: value.days.includes(d) ? value.days.filter((x) => x !== d) : [...value.days, d] });

  return (
    <>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}-pro`}>Profesional preferente</label>
        <select id={`${idPrefix}-pro`} className={styles.select} value={value.professionalId} onChange={(e) => set({ professionalId: e.target.value })}>
          <option value="">Cualquiera</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <span className={styles.label} id={`${idPrefix}-days`}>Días</span>
        <div className={styles.days} role="group" aria-labelledby={`${idPrefix}-days`}>
          {WEEKDAYS.map((d) => {
            const on = value.days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                className={`${styles.day} ${on ? styles.dayOn : ""}`}
                aria-pressed={on}
                aria-label={d.long}
                onClick={() => toggleDay(d.value)}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        <span className={styles.hint}>Sin selección = cualquier día.</span>
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-from`}>Desde</label>
          <input id={`${idPrefix}-from`} type="time" className={styles.input} value={value.timeFrom} onChange={(e) => set({ timeFrom: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-to`}>Hasta</label>
          <input id={`${idPrefix}-to`} type="time" className={styles.input} value={value.timeTo} onChange={(e) => set({ timeTo: e.target.value })} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}-notes`}>Notas</label>
        <textarea
          id={`${idPrefix}-notes`}
          className={styles.textarea}
          maxLength={NOTES_MAX}
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
    </>
  );
}

"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { WaitlistPreferencesFields, type PreferencesState } from "./WaitlistPreferencesFields";
import { removeWaitlistEntryAction, updateWaitlistEntryAction } from "@/app/actions/waitlist";
import type { CatalogItem } from "@/lib/kmbook/waitlist";
import type { SettableStatus, WaitlistEntry } from "@/lib/kmbook/waitlist-format";
import styles from "./Waitlist.module.css";

interface Props {
  organizationId: string;
  entry: WaitlistEntry;
  professionals: CatalogItem[];
}

/**
 * Editar preferencias, marcar «contactada» / «en cola» o retirar. NUNCA ofrece «reservada»:
 * ese estado lo fija Core al confirmarse la cita (waitlist_booked_requires_appointment).
 */
export function WaitlistEntryManager({ organizationId, entry, professionals }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState<PreferencesState>({
    professionalId: entry.preferredProfessionalId ?? "",
    days: entry.preferredDays,
    timeFrom: entry.timeFrom ?? "",
    timeTo: entry.timeTo ?? "",
    notes: entry.notes ?? "",
  });
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Sólo se puede editar una entrada abierta y sin cita vinculada.
  const editable = (entry.status === "active" || entry.status === "contacted") && !entry.appointment;
  if (!editable) return null;

  const save = (status: SettableStatus) =>
    startTransition(async () => {
      setFeedback(null);
      const res = await updateWaitlistEntryAction(organizationId, entry.id, {
        professionalId: prefs.professionalId || null,
        days: prefs.days,
        timeFrom: prefs.timeFrom || null,
        timeTo: prefs.timeTo || null,
        notes: prefs.notes || null,
        status,
      });
      setFeedback({ ok: res.success, text: res.message });
      if (res.success) router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      setFeedback(null);
      const res = await removeWaitlistEntryAction(organizationId, entry.id);
      if (!res.success) return setFeedback({ ok: false, text: res.message });
      router.push("/waitlist");
      router.refresh();
    });

  return (
    <section className={styles.section} aria-label="Editar entrada" data-testid="entry-manager">
      <h2 className={styles.sectionTitle}>Preferencias</h2>
      <WaitlistPreferencesFields value={prefs} onChange={setPrefs} professionals={professionals} idPrefix="wl-edit" />

      {feedback && <div className={`${styles.message} ${feedback.ok ? styles.ok : styles.error}`} role="alert">{feedback.text}</div>}

      <div className={styles.actions}>
        <Button type="button" variant="primary" isLoading={pending} onClick={() => save(entry.status === "contacted" ? "contacted" : "active")}>
          Guardar cambios
        </Button>
        {entry.status === "active" ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => save("contacted")}>
            Marcar como contactada
          </Button>
        ) : (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => save("active")}>
            Volver a la cola
          </Button>
        )}
        {confirmRemove ? (
          <>
            <Button type="button" variant="danger" isLoading={pending} onClick={remove}>
              Confirmar retirada
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirmRemove(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button type="button" variant="danger" disabled={pending} onClick={() => setConfirmRemove(true)}>
            Retirar de la lista
          </Button>
        )}
      </div>
    </section>
  );
}

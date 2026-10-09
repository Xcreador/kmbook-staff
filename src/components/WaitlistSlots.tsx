"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { offerWaitlistSlotAction } from "@/app/actions/waitlist";
import { formatDayHeading, groupSlots, type CompatibleSlot } from "@/lib/kmbook/waitlist-format";
import styles from "./Waitlist.module.css";

interface Props {
  organizationId: string;
  entryId: string;
  slots: CompatibleSlot[];
  /** Con una oferta vigente no se ofrece otro hueco: primero hay que retirarla. */
  hasPendingOffer: boolean;
}

/** Huecos compatibles de los próximos 14 días, por día y profesional. «Ofrecer» y «Reservar» llaman a Core. */
export function WaitlistSlots({ organizationId, entryId, slots, hasPendingOffer }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<CompatibleSlot | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const groups = groupSlots(slots);

  if (groups.length === 0) {
    return (
      <p className={styles.hint} data-testid="no-slots">
        No hay huecos compatibles en los próximos 14 días. Cuando se libere uno, Core avisará a recepción.
      </p>
    );
  }

  const offer = () => {
    if (!selected) return;
    startTransition(async () => {
      setFeedback(null);
      const res = await offerWaitlistSlotAction(organizationId, entryId, selected.professionalId, selected.startsAt);
      setFeedback({ ok: res.success, text: res.message });
      if (res.success) {
        setSelected(null);
        router.refresh();
      }
    });
  };

  const bookHref = selected
    ? `/waitlist/${entryId}/book?pro=${encodeURIComponent(selected.professionalId)}&at=${encodeURIComponent(selected.startsAt)}`
    : "#";

  return (
    <div className={styles.stack} data-testid="slots">
      {groups.map((day) => (
        <div key={day.date} className={styles.dayGroup}>
          <div className={styles.dayHeading}>{formatDayHeading(day.date)}</div>
          {day.professionals.map((pro) => (
            <div key={pro.professionalId} className={styles.proRow}>
              <div className={styles.proName}>{pro.professionalName}</div>
              <div className={styles.slotGrid}>
                {pro.slots.map((s) => {
                  const on = selected?.startsAt === s.startsAt && selected.professionalId === s.professionalId;
                  return (
                    <button
                      key={`${s.professionalId}-${s.startsAt}`}
                      type="button"
                      className={`${styles.slot} ${on ? styles.slotOn : ""}`}
                      aria-pressed={on}
                      onClick={() => setSelected(on ? null : s)}
                    >
                      {s.time}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {feedback && <div className={`${styles.message} ${feedback.ok ? styles.ok : styles.error}`} role="alert">{feedback.text}</div>}

      <div className={styles.actions}>
        <Button type="button" variant="accent" disabled={!selected || hasPendingOffer} isLoading={pending} onClick={offer}>
          Ofrecer hueco
        </Button>
        {selected ? (
          <Link href={bookHref} className={styles.agendaLink} data-testid="book-link">
            Reservar este hueco
          </Link>
        ) : (
          <span className={styles.hint}>Elige un hueco para ofrecerlo o reservarlo.</span>
        )}
      </div>
      {hasPendingOffer && <span className={styles.hint}>Hay una oferta vigente. Retírala para ofrecer otro hueco.</span>}
    </div>
  );
}

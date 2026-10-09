"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { Countdown } from "./Countdown";
import { withdrawWaitlistOfferAction } from "@/app/actions/waitlist";
import { offerOriginLabel, type WaitlistOffer } from "@/lib/kmbook/waitlist-format";
import styles from "./Waitlist.module.css";

interface Props {
  organizationId: string;
  entryId: string;
  offer: WaitlistOffer;
}

export function WaitlistOfferPanel({ organizationId, entryId, offer }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const when = new Date(offer.startsAt);

  const withdraw = () =>
    startTransition(async () => {
      setFeedback(null);
      const res = await withdrawWaitlistOfferAction(organizationId, entryId, offer.id);
      setFeedback({ ok: res.success, text: res.message });
      if (res.success) router.refresh();
    });

  return (
    <div className={styles.offer} data-testid="offer-panel">
      <span className={styles.offerTitle}>{offerOriginLabel(offer.origin)} vigente</span>
      <span className={styles.offerText}>
        {when.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })},{" "}
        {when.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false })}
        {offer.professionalName ? ` · ${offer.professionalName}` : ""}
      </span>
      <Countdown expiresAt={offer.expiresAt} />
      {feedback && <div className={`${styles.message} ${feedback.ok ? styles.ok : styles.error}`} role="alert">{feedback.text}</div>}
      <div className={styles.actions}>
        <Button type="button" variant="danger" size="sm" isLoading={pending} onClick={withdraw}>
          Retirar oferta
        </Button>
      </div>
    </div>
  );
}

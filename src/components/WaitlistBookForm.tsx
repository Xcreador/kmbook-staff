"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "./Button";
import { bookWaitlistEntryAction } from "@/app/actions/waitlist";
import { formatMoney } from "@/lib/kmbook/trust-format";
import {
  BOOK_PENDING_TEXT,
  DEPOSIT_METHODS,
  WAIVE_REASON_MAX,
  WAIVE_REASON_MIN,
  newIdempotencyKey,
  validateBookInput,
  type BookInput,
  type DepositQuote,
} from "@/lib/kmbook/waitlist-format";
import styles from "./Waitlist.module.css";

interface Props {
  organizationId: string;
  entryId: string;
  clientId: string;
  serviceId: string;
  professionalId: string;
  startsAt: string;
  /** Presupuesto de Core. null = Core no lo ha dado: se muestra sin importes y sin «Omitir». */
  quote: DepositQuote | null;
}

type Mode = "collect" | "pending" | "waive";

/**
 * Convierte la entrada en reserva real. Todo lo decide Core (book_waitlist_entry):
 * el importe exigido, si se puede omitir (`can_waive`) y la confirmación. «Omitir depósito» sólo se
 * ofrece si Core indica `can_waive`, y exige motivo. Una clave de idempotencia por formulario.
 */
export function WaitlistBookForm({ organizationId, entryId, clientId, serviceId, professionalId, startsAt, quote }: Props) {
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState<string>(() => newIdempotencyKey());

  const needsDeposit = quote ? quote.enabled && quote.required > 0 : true;
  const canWaive = quote?.canWaive === true;
  const canRecord = quote ? quote.canRecord : true;

  const [mode, setMode] = useState<Mode>(canRecord ? "collect" : "pending");
  const [amount, setAmount] = useState<string>(quote && quote.required > 0 ? String(quote.required) : "");
  const [method, setMethod] = useState<string>("cash");
  const [provider, setProvider] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState<{ appointmentId: string; status: string; text: string } | null>(null);

  const methodDef = DEPOSIT_METHODS.find((m) => m.value === method);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const parsedAmount = amount.trim() === "" ? null : Number(amount.replace(",", "."));
    const input: BookInput = {
      depositAmount: mode === "collect" && needsDeposit ? parsedAmount : null,
      method: mode === "collect" && needsDeposit ? method : null,
      provider: mode === "collect" && methodDef?.needsProvider ? provider.trim() : null,
      reference: mode === "collect" ? reference : null,
      waive: mode === "waive",
      waiveReason: mode === "waive" ? reason : null,
    };
    const valid = validateBookInput(input, { canWaive });
    if (!valid.ok) return setFeedback({ ok: false, text: valid.message });

    startTransition(async () => {
      const res = await bookWaitlistEntryAction(organizationId, entryId, clientId, serviceId, professionalId, startsAt, input, idempotencyKey);
      if (!res.success) return setFeedback({ ok: false, text: res.message });
      setDone({ appointmentId: res.appointmentId ?? "", status: res.appointmentStatus ?? "pending", text: res.message });
    });
  };

  if (done) {
    return (
      <div className={styles.stack} data-testid="book-done">
        <div className={`${styles.message} ${done.status === "pending" ? styles.error : styles.ok}`} role="status">
          {done.text}
        </div>
        <div className={styles.actions}>
          {done.appointmentId && (
            <Link href={`/appointments/${done.appointmentId}`} className={styles.agendaLink}>
              Ver la cita
            </Link>
          )}
          <Link href="/waitlist" className={styles.agendaLink}>
            Volver a la lista de espera
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.stack} onSubmit={submit} data-testid="book-form">
      {quote && quote.enabled && (
        <dl className={styles.lines} data-testid="quote-lines">
          <div className={styles.line}>
            <dt>Total del servicio</dt>
            <dd>{formatMoney(quote.total, quote.currency)}</dd>
          </div>
          <div className={styles.line}>
            <dt>Depósito aplicable{quote.depositPercent > 0 ? ` (${quote.depositPercent} %)` : ""}</dt>
            <dd>{formatMoney(quote.required, quote.currency)}</dd>
          </div>
        </dl>
      )}
      {quote && !quote.enabled && <p className={styles.hint}>Esta clienta no tiene depósito exigido. La reserva se creará directamente.</p>}
      {!quote && <p className={styles.hint}>Core calculará el depósito al reservar.</p>}

      {needsDeposit && (
        <fieldset className={styles.section} style={{ border: 0 }}>
          <legend className={styles.sectionTitle}>Depósito</legend>

          {canRecord && (
            <label className={styles.radioRow}>
              <input type="radio" name="mode" checked={mode === "collect"} onChange={() => setMode("collect")} />
              <span>Cobrar el depósito ahora</span>
            </label>
          )}
          <label className={styles.radioRow}>
            <input type="radio" name="mode" checked={mode === "pending"} onChange={() => setMode("pending")} />
            <span>Dejar la reserva pendiente</span>
          </label>
          {canWaive && (
            <label className={styles.radioRow}>
              <input type="radio" name="mode" checked={mode === "waive"} onChange={() => setMode("waive")} />
              <span>Omitir depósito</span>
            </label>
          )}

          {mode === "collect" && (
            <>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="wl-amount">Importe cobrado</label>
                  <input id="wl-amount" className={styles.input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="wl-method">Método</label>
                  <select id="wl-method" className={styles.select} value={method} onChange={(e) => setMethod(e.target.value)}>
                    {DEPOSIT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {methodDef?.needsProvider && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="wl-provider">Medio de pago</label>
                  <input id="wl-provider" className={styles.input} value={provider} placeholder="p. ej. datafono_b" onChange={(e) => setProvider(e.target.value.toLowerCase())} />
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="wl-reference">Referencia (opcional)</label>
                <input id="wl-reference" className={styles.input} maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />
                <span className={styles.hint}>No escribas números de tarjeta.</span>
              </div>
            </>
          )}

          {mode === "waive" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="wl-reason">Motivo de la omisión</label>
              <textarea
                id="wl-reason"
                className={styles.textarea}
                maxLength={WAIVE_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-describedby="wl-reason-hint"
              />
              <span id="wl-reason-hint" className={styles.hint}>Obligatorio, mínimo {WAIVE_REASON_MIN} caracteres. Queda registrado.</span>
            </div>
          )}

          {(mode === "pending" || (mode === "collect" && amount.trim() === "")) && (
            <div className={`${styles.linked} ${styles.warn}`} role="note">
              <span className={styles.offerText}>{BOOK_PENDING_TEXT}</span>
            </div>
          )}
        </fieldset>
      )}

      {feedback && <div className={`${styles.message} ${feedback.ok ? styles.ok : styles.error}`} role="alert">{feedback.text}</div>}

      <Button type="submit" variant="accent" fullWidth isLoading={pending}>
        Crear la reserva
      </Button>
    </form>
  );
}

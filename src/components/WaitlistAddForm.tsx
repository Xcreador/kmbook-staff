"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { WaitlistPreferencesFields, type PreferencesState } from "./WaitlistPreferencesFields";
import { addWaitlistEntryAction, searchClientsAction, type ClientSearchResult } from "@/app/actions/waitlist";
import type { CatalogItem } from "@/lib/kmbook/waitlist";
import styles from "./Waitlist.module.css";

interface Props {
  organizationId: string;
  services: CatalogItem[];
  professionals: CatalogItem[];
}

export function WaitlistAddForm({ organizationId, services, professionals }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [client, setClient] = useState<ClientSearchResult | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [prefs, setPrefs] = useState<PreferencesState>({ professionalId: "", days: [], timeFrom: "", timeTo: "", notes: "" });
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (client || query.trim().length < 2) return;
    const handle = setTimeout(async () => {
      const res = await searchClientsAction(organizationId, query);
      if (res.success) setResults(res.clients);
      else setFeedback({ ok: false, text: res.message });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, client, organizationId]);

  const visibleResults = client || query.trim().length < 2 ? [] : results;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!client) return setFeedback({ ok: false, text: "Elige la clienta." });
    if (!serviceId) return setFeedback({ ok: false, text: "Elige el servicio." });
    startTransition(async () => {
      const res = await addWaitlistEntryAction(organizationId, {
        clientId: client.id,
        serviceId,
        professionalId: prefs.professionalId || null,
        days: prefs.days,
        timeFrom: prefs.timeFrom || null,
        timeTo: prefs.timeTo || null,
        notes: prefs.notes || null,
      });
      if (!res.success) return setFeedback({ ok: false, text: res.message });
      router.push(res.entryId ? `/waitlist/${res.entryId}` : "/waitlist");
      router.refresh();
    });
  };

  return (
    <form className={styles.stack} onSubmit={submit} data-testid="waitlist-add-form">
      <div className={styles.field}>
        <label className={styles.label} htmlFor="wl-client">Clienta</label>
        {client ? (
          <div className={styles.selected}>
            <span>{client.name}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setClient(null); setQuery(""); }}>
              Cambiar
            </Button>
          </div>
        ) : (
          <>
            <input
              id="wl-client"
              className={styles.input}
              type="search"
              autoComplete="off"
              placeholder="Buscar por nombre"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {visibleResults.length > 0 && (
              <div className={styles.results} role="listbox" aria-label="Resultados">
                {visibleResults.map((c) => (
                  <button key={c.id} type="button" role="option" aria-selected={false} className={styles.result} onClick={() => setClient(c)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {query.trim().length >= 2 && visibleResults.length === 0 && <span className={styles.hint}>Sin resultados.</span>}
          </>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="wl-service">Servicio</label>
        <select id="wl-service" className={styles.select} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Elige un servicio</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <WaitlistPreferencesFields value={prefs} onChange={setPrefs} professionals={professionals} idPrefix="wl-add" />

      {feedback && <div className={`${styles.message} ${feedback.ok ? styles.ok : styles.error}`} role="alert">{feedback.text}</div>}

      <Button type="submit" variant="accent" fullWidth isLoading={pending}>
        Añadir a la lista de espera
      </Button>
    </form>
  );
}

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  listStaffPushDevicesAction,
  revokeStaffPushDeviceAction,
  sendStaffPushTestAction,
  setStaffPushPreferenceAction,
  subscribeStaffPushAction,
  unsubscribeStaffPushAction,
  type StaffPushDevice,
  type StaffPushPreference,
} from "@/app/actions/push";
import { getCurrentPushSubscription, registerServiceWorker, subscribeToPush } from "@/lib/kmbook/push";
import { describeDevice, detectPushSupport, isValidVapidPublicKey, type PushSupport } from "@/lib/kmbook/push-routing";
import styles from "./StaffPushSettings.module.css";

/**
 * KMBOOK Staff — Perfil → Notificaciones.
 * El permiso SÓLO se pide al pulsar «Activar notificaciones»; nunca al abrir la app.
 */

const SUPPORT_TEXT: Record<PushSupport, string> = {
  supported: "Este navegador admite notificaciones Push.",
  ios_needs_install:
    "En iPhone y iPad las notificaciones sólo funcionan con KMBOOK Staff añadida a la pantalla de inicio (iOS 16.4 o posterior). Ábrela desde el icono instalado.",
  insecure_context: "Las notificaciones requieren una conexión segura (HTTPS).",
  unsupported: "Este navegador no admite notificaciones Push.",
};

type Permission = NotificationPermission | "unknown";
const PERMISSION_TEXT: Record<Permission, string> = { granted: "Concedido", denied: "Denegado", default: "Pendiente", unknown: "—" };

function readSupport(): PushSupport {
  const nav = navigator as Navigator & { standalone?: boolean };
  return detectPushSupport({
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
    isSecureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
    isStandalone: window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true,
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function StaffPushSettings({
  vapidPublicKey,
  preferences: initialPreferences,
  organizationName,
}: {
  vapidPublicKey: string | null;
  preferences: StaffPushPreference[];
  organizationName: string;
}) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [permission, setPermission] = useState<Permission>("unknown");
  const [devices, setDevices] = useState<StaffPushDevice[]>([]);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const configured = isValidVapidPublicKey(vapidPublicKey);

  const refresh = useCallback(async () => {
    const detected = readSupport();
    const current = detected === "supported" ? await getCurrentPushSubscription() : null;
    const list = await listStaffPushDevicesAction(current?.endpoint ?? null);
    setSupport(detected);
    setPermission("Notification" in window ? Notification.permission : "unknown");
    setDevices(list);
  }, []);

  useEffect(() => {
    // Sólo lee estado del navegador; no pide permiso ni registra nada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const currentActive = devices.some((device) => device.isCurrent);

  function activate() {
    setMessage(null);
    startTransition(async () => {
      if (!configured || !vapidPublicKey) {
        setMessage({ text: "Las notificaciones no están configuradas en este entorno.", error: true });
        return;
      }
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage({
          text: result === "denied"
            ? "Has bloqueado las notificaciones. Puedes permitirlas en los ajustes del navegador o del sistema."
            : "No se ha concedido el permiso.",
          error: true,
        });
        return;
      }
      await registerServiceWorker();
      const subscription = await subscribeToPush(vapidPublicKey);
      if (!subscription) {
        setMessage({ text: "El navegador no ha permitido crear la suscripción.", error: true });
        return;
      }
      const json = subscription.toJSON();
      const saved = await subscribeStaffPushAction({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        deviceLabel: describeDevice(navigator.userAgent),
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setMessage(saved.ok ? { text: "Notificaciones activadas en este dispositivo.", error: false } : { text: saved.message, error: true });
      await refresh();
    });
  }

  function deactivate() {
    setMessage(null);
    startTransition(async () => {
      const subscription = await getCurrentPushSubscription();
      if (!subscription) {
        setMessage({ text: "Este navegador no tiene ninguna suscripción activa.", error: false });
        await refresh();
        return;
      }
      // 1) Baja en el servidor (requiere la sesión). 2) Baja en el navegador, SIEMPRE:
      // aunque el servidor falle, el endpoint deja de existir y Core lo poda al primer envío.
      const server = await unsubscribeStaffPushAction(subscription.endpoint);
      const browser = await subscription.unsubscribe().catch(() => false);
      if (server.ok && browser) {
        setMessage({ text: "Este dispositivo ya no recibirá notificaciones.", error: false });
      } else if (!server.ok && browser) {
        setMessage({
          text: "Se ha desactivado en este navegador, pero no se pudo confirmar la baja en el servidor. No recibirás avisos aquí; el registro se limpiará automáticamente. Si persiste, desactívalo desde la lista de dispositivos.",
          error: true,
        });
      } else if (server.ok && !browser) {
        setMessage({ text: "Baja registrada en el servidor, pero el navegador no confirmó la anulación. Revisa los permisos de notificaciones del sistema.", error: true });
      } else {
        setMessage({ text: "No se pudo desactivar. Comprueba tu conexión e inténtalo de nuevo.", error: true });
      }
      await refresh();
    });
  }

  function revoke(device: StaffPushDevice) {
    if (device.isCurrent) return deactivate();
    startTransition(async () => {
      const result = await revokeStaffPushDeviceAction(device.id);
      if (!result.ok) setMessage({ text: result.message, error: true });
      await refresh();
    });
  }

  function sendTest() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendStaffPushTestAction();
      setMessage({ text: result.message ?? "Prueba enviada.", error: !result.ok });
    });
  }

  function toggle(eventType: string, enabled: boolean) {
    setPreferences((list) => list.map((item) => (item.eventType === eventType ? { ...item, push: enabled } : item)));
    startTransition(async () => {
      const result = await setStaffPushPreferenceAction({ eventType, enabled });
      if (!result.ok) {
        setPreferences((list) => list.map((item) => (item.eventType === eventType ? { ...item, push: !enabled } : item)));
        setMessage({ text: result.message, error: true });
      }
    });
  }

  if (!support) return <p className={styles.hint}>Comprobando este dispositivo…</p>;
  const canActivate = support === "supported" && configured && permission !== "denied";

  return (
    <div className={styles.wrap} data-testid="staff-push-settings">
      <section className={styles.card}>
        <h3 className={styles.title}>ESTE DISPOSITIVO</h3>
        <p className={styles.hint}>{SUPPORT_TEXT[support]}</p>
        <dl className={styles.status}>
          <div><dt>Compatibilidad</dt><dd data-testid="push-support">{support === "supported" ? "Compatible" : "No disponible"}</dd></div>
          <div><dt>Permiso</dt><dd data-testid="push-permission">{PERMISSION_TEXT[permission]}</dd></div>
          <div><dt>Estado</dt><dd data-testid="push-state">{currentActive ? "Activas" : "Desactivadas"}</dd></div>
        </dl>
        {!configured ? <p className={styles.hint}>El envío de notificaciones todavía no está configurado.</p> : null}
        <div className={styles.actions}>
          {currentActive ? (
            <>
              <button className={styles.secondary} disabled={pending} onClick={sendTest} type="button">Enviar notificación de prueba</button>
              <button className={styles.secondary} disabled={pending} onClick={deactivate} type="button">Desactivar en este dispositivo</button>
            </>
          ) : (
            <button className={styles.primary} disabled={pending || !canActivate} onClick={activate} type="button">
              {pending ? "Activando…" : "Activar notificaciones"}
            </button>
          )}
        </div>
        {message ? (
          <p className={message.error ? styles.error : styles.hint} role={message.error ? "alert" : "status"}>{message.text}</p>
        ) : null}
        <p className={styles.hint}>Avisos de {organizationName}. Al cambiar de negocio o cerrar sesión, este dispositivo se da de baja.</p>
      </section>

      <section className={styles.card}>
        <h3 className={styles.title}>QUÉ QUIERES RECIBIR</h3>
        {preferences.map((item) => (
          <label className={styles.row} key={item.eventType}>
            <input checked={item.push} disabled={pending} onChange={(event) => toggle(item.eventType, event.target.checked)} type="checkbox" />
            <span>{item.title}</span>
          </label>
        ))}
        <p className={styles.hint}>El texto es genérico: nunca muestra el nombre de una clienta ni detalles de la cita. La bandeja de avisos conserva todos.</p>
      </section>

      <section className={styles.card}>
        <h3 className={styles.title}>DISPOSITIVOS</h3>
        {devices.length === 0 ? <p className={styles.hint}>Ningún dispositivo suscrito.</p> : (
          <ul className={styles.devices} data-testid="push-devices">
            {devices.map((device) => (
              <li key={device.id}>
                <span>
                  <strong>{device.label}</strong>{device.isCurrent ? " · Este dispositivo" : ""}
                  <small>Alta {formatDate(device.createdAt)} · Última entrega {formatDate(device.lastSuccessAt)}</small>
                </span>
                <button className={styles.secondary} disabled={pending} onClick={() => revoke(device)} type="button">Desactivar</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

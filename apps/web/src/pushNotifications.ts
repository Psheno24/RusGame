import {
  deletePushSubscription,
  fetchNotificationPrefs,
  fetchVapidPublicKey,
  savePushSubscription,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "./api";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function ensurePushSubscription(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!pushSupported()) {
    return { ok: false, reason: "Браузер не поддерживает push-уведомления" };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, reason: "Разрешите уведомления в настройках браузера" };
  }

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await fetchVapidPublicKey();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, reason: "Не удалось оформить подписку" };
  }

  await savePushSubscription({ endpoint, keys: { p256dh, auth } });
  return { ok: true };
}

async function setPref<K extends keyof NotificationPrefs>(
  key: K,
  enabled: boolean,
): Promise<string | null> {
  if (enabled) {
    const sub = await ensurePushSubscription();
    if (!sub.ok) return sub.reason;
  }
  await updateNotificationPrefs({ [key]: enabled });
  return null;
}

export async function setShiftReadyNotifications(enabled: boolean): Promise<string | null> {
  return setPref("shiftReady", enabled);
}

export async function setHousingPaymentNotifications(enabled: boolean): Promise<string | null> {
  return setPref("housingPayment", enabled);
}

export async function setRelocationNotifications(enabled: boolean): Promise<string | null> {
  return setPref("relocation", enabled);
}

export async function setEducationReadyNotifications(enabled: boolean): Promise<string | null> {
  return setPref("educationReady", enabled);
}

export async function loadNotificationPrefs() {
  const { prefs } = await fetchNotificationPrefs();
  return prefs;
}

export async function removeCurrentPushSubscription() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await deletePushSubscription(endpoint);
  await subscription.unsubscribe();
}

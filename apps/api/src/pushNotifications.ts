import webpush from "web-push";
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "./config.js";
import { getDb } from "./db.js";

export type NotificationPrefs = {
  shiftReady: boolean;
};

export type PushScheduleKind = "shift_ready";

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function getNotificationPrefs(userId: number): NotificationPrefs {
  const row = getDb()
    .prepare("SELECT shift_ready FROM notification_prefs WHERE user_id = ?")
    .get(userId) as { shift_ready: number } | undefined;
  if (!row) return { shiftReady: false };
  return { shiftReady: row.shift_ready === 1 };
}

export function updateNotificationPrefs(
  userId: number,
  patch: Partial<NotificationPrefs>,
): NotificationPrefs {
  const cur = getNotificationPrefs(userId);
  const next: NotificationPrefs = {
    shiftReady: patch.shiftReady ?? cur.shiftReady,
  };
  getDb()
    .prepare(
      `INSERT INTO notification_prefs (user_id, shift_ready, taxi_trip_end, updated_at)
       VALUES (?, ?, 0, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         shift_ready = excluded.shift_ready,
         updated_at = excluded.updated_at`,
    )
    .run(userId, next.shiftReady ? 1 : 0, Date.now());
  return next;
}

export function upsertPushSubscription(
  userId: number,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  getDb()
    .prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, endpoint) DO UPDATE SET
         p256dh = excluded.p256dh,
         auth = excluded.auth`,
    )
    .run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, Date.now());
}

export function deletePushSubscription(userId: number, endpoint: string) {
  getDb()
    .prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?")
    .run(userId, endpoint);
}

function cancelPendingSchedule(userId: number, kind: PushScheduleKind) {
  getDb()
    .prepare(
      `UPDATE push_schedule
       SET canceled_at = ?
       WHERE user_id = ? AND kind = ? AND sent_at IS NULL AND canceled_at IS NULL`,
    )
    .run(Date.now(), userId, kind);
}

function insertSchedule(userId: number, kind: PushScheduleKind, fireAt: number, payload: object) {
  getDb()
    .prepare(
      `INSERT INTO push_schedule (user_id, kind, fire_at, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(userId, kind, fireAt, JSON.stringify(payload), Date.now());
}

export function scheduleShiftReadyPush(
  userId: number,
  jobId: string,
  jobTitle: string,
  fireAt: number,
) {
  cancelPendingSchedule(userId, "shift_ready");
  if (fireAt <= Date.now()) return;
  insertSchedule(userId, "shift_ready", fireAt, { jobId, jobTitle });
}

function prefEnabled(prefs: NotificationPrefs): boolean {
  return prefs.shiftReady;
}

function buildPushPayload(payloadJson: string): PushPayload {
  const data = JSON.parse(payloadJson) as { jobTitle?: string };
  const jobTitle = data.jobTitle ?? "работа";
  return {
    title: "Смена доступна",
    body: `Можно выйти на работу — ${jobTitle}`,
    url: "/work",
  };
}

async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<"ok" | "gone"> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return "ok";
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("push send failed", status, err);
    return "ok";
  }
}

export async function sendPushToUser(userId: number, payload: PushPayload) {
  const subs = getDb()
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
    .all(userId) as Array<{ endpoint: string; p256dh: string; auth: string }>;
  for (const sub of subs) {
    const result = await sendPushToSubscription(sub, payload);
    if (result === "gone") {
      getDb()
        .prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?")
        .run(userId, sub.endpoint);
    }
  }
}

export async function processDuePushNotifications(now = Date.now()) {
  const due = getDb()
    .prepare(
      `SELECT id, user_id, kind, payload_json
       FROM push_schedule
       WHERE fire_at <= ? AND sent_at IS NULL AND canceled_at IS NULL
       ORDER BY fire_at ASC
       LIMIT 50`,
    )
    .all(now) as Array<{
    id: number;
    user_id: number;
    kind: PushScheduleKind;
    payload_json: string;
  }>;

  for (const row of due) {
    const prefs = getNotificationPrefs(row.user_id);
    if (prefEnabled(prefs)) {
      const payload = buildPushPayload(row.payload_json);
      await sendPushToUser(row.user_id, payload);
    }
    getDb()
      .prepare("UPDATE push_schedule SET sent_at = ? WHERE id = ?")
      .run(now, row.id);
  }
}

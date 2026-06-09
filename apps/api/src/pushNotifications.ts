import webpush from "web-push";
import type { PlayerRow } from "./db.js";
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "./config.js";
import { getDb } from "./db.js";
import { getCity } from "./gameData.js";

const MS_DAY = 24 * 60 * 60 * 1000;

export type NotificationPrefs = {
  shiftReady: boolean;
  housingPayment: boolean;
  relocation: boolean;
  educationReady: boolean;
};

export type PushScheduleKind =
  | "shift_ready"
  | "taxi_trip_end"
  | "delivery_trip_end"
  | "housing_payment"
  | "travel_arrive"
  | "education_lesson_ready";

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
    .prepare(
      "SELECT shift_ready, housing_payment, relocation, education_ready FROM notification_prefs WHERE user_id = ?",
    )
    .get(userId) as
    | { shift_ready: number; housing_payment: number; relocation: number; education_ready?: number }
    | undefined;
  if (!row) {
    return { shiftReady: false, housingPayment: false, relocation: false, educationReady: false };
  }
  return {
    shiftReady: row.shift_ready === 1,
    housingPayment: row.housing_payment === 1,
    relocation: row.relocation === 1,
    educationReady: (row.education_ready ?? 0) === 1,
  };
}

export function updateNotificationPrefs(
  userId: number,
  patch: Partial<NotificationPrefs>,
): NotificationPrefs {
  const cur = getNotificationPrefs(userId);
  const next: NotificationPrefs = {
    shiftReady: patch.shiftReady ?? cur.shiftReady,
    housingPayment: patch.housingPayment ?? cur.housingPayment,
    relocation: patch.relocation ?? cur.relocation,
    educationReady: patch.educationReady ?? cur.educationReady,
  };
  getDb()
    .prepare(
      `INSERT INTO notification_prefs (user_id, shift_ready, taxi_trip_end, housing_payment, relocation, education_ready, updated_at)
       VALUES (?, ?, 0, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         shift_ready = excluded.shift_ready,
         housing_payment = excluded.housing_payment,
         relocation = excluded.relocation,
         education_ready = excluded.education_ready,
         updated_at = excluded.updated_at`,
    )
    .run(
      userId,
      next.shiftReady ? 1 : 0,
      next.housingPayment ? 1 : 0,
      next.relocation ? 1 : 0,
      next.educationReady ? 1 : 0,
      Date.now(),
    );
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

function schedulePush(userId: number, kind: PushScheduleKind, fireAt: number, payload: object) {
  cancelPendingSchedule(userId, kind);
  if (fireAt <= Date.now()) return;
  insertSchedule(userId, kind, fireAt, payload);
}

export function scheduleShiftReadyPush(
  userId: number,
  jobId: string,
  jobTitle: string,
  fireAt: number,
) {
  schedulePush(userId, "shift_ready", fireAt, { jobId, jobTitle });
}

export function scheduleTaxiTripEndPush(userId: number, fireAt: number) {
  schedulePush(userId, "taxi_trip_end", fireAt, {});
}

export function scheduleDeliveryTripEndPush(userId: number, fireAt: number) {
  schedulePush(userId, "delivery_trip_end", fireAt, {});
}

export function scheduleEducationLessonReadyPush(userId: number, fireAt: number) {
  schedulePush(userId, "education_lesson_ready", fireAt, {});
}

export function cancelEducationLessonReadyPush(userId: number) {
  cancelPendingSchedule(userId, "education_lesson_ready");
}

export function scheduleTravelArrivePush(userId: number, cityId: string, fireAt: number) {
  const city = getCity(cityId);
  schedulePush(userId, "travel_arrive", fireAt, { cityId, cityName: city?.name ?? cityId });
}

export function cancelTravelArrivePush(userId: number) {
  cancelPendingSchedule(userId, "travel_arrive");
}

function housingPaymentDaysLabel(daysLeft: number): string {
  const mod10 = daysLeft % 10;
  const mod100 = daysLeft % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

export function housingPaymentPushBody(daysLeft: number): { title: string; body: string } {
  const word = housingPaymentDaysLabel(daysLeft);
  return {
    title: "Можно продлить аренду жилья",
    body: `Осталось ${daysLeft} ${word} до конца текущей аренды.`,
  };
}

export function syncHousingPaymentPush(player: PlayerRow, now = Date.now()) {
  cancelPendingSchedule(player.user_id, "housing_payment");
  if (player.housing_type !== "dorm" && player.housing_type !== "rent") return;
  if (player.housing_expires_at == null || player.housing_expires_at <= now) return;

  const expiresAt = player.housing_expires_at;
  const reminders =
    player.housing_type === "rent"
      ? [
          { daysLeft: 7, fireAt: expiresAt - 7 * MS_DAY },
          { daysLeft: 1, fireAt: expiresAt - MS_DAY },
        ]
      : [{ daysLeft: 1, fireAt: expiresAt - MS_DAY }];

  for (const { daysLeft, fireAt } of reminders) {
    if (fireAt <= now) continue;
    insertSchedule(player.user_id, "housing_payment", fireAt, {
      housingType: player.housing_type,
      daysLeft,
    });
  }
}

function prefEnabledForKind(prefs: NotificationPrefs, kind: PushScheduleKind): boolean {
  switch (kind) {
    case "shift_ready":
    case "taxi_trip_end":
    case "delivery_trip_end":
      return prefs.shiftReady;
    case "housing_payment":
      return prefs.housingPayment;
    case "travel_arrive":
      return prefs.relocation;
    case "education_lesson_ready":
      return prefs.educationReady;
    default:
      return false;
  }
}

function buildPushPayload(kind: PushScheduleKind, payloadJson: string): PushPayload {
  const data = JSON.parse(payloadJson) as {
    jobTitle?: string;
    housingType?: "dorm" | "rent";
    daysLeft?: number;
    cityName?: string;
  };

  switch (kind) {
    case "shift_ready": {
      const jobTitle = data.jobTitle ?? "работа";
      return {
        title: "Можно выйти на смену",
        body: `(${jobTitle})`,
        url: "/work?panel=job",
      };
    }
    case "taxi_trip_end":
      return {
        title: "Выберите новый заказ",
        body: "или закончите смену (Такси)",
        url: "/work?panel=job",
      };
    case "delivery_trip_end":
      return {
        title: "Можно взять новый заказ",
        body: "(Доставка)",
        url: "/work?panel=job",
      };
    case "housing_payment": {
      const daysLeft = data.daysLeft ?? 1;
      const housing = housingPaymentPushBody(daysLeft);
      return {
        title: housing.title,
        body: housing.body,
        url: "/home?panel=housing",
      };
    }
    case "travel_arrive": {
      const cityName = data.cityName ?? "город";
      return {
        title: "Вы добрались",
        body: `до ${cityName}`,
        url: "/map?panel=travel",
      };
    }
    case "education_lesson_ready":
      return {
        title: "Можно идти на занятие",
        body: "Образование",
        url: "/city?panel=education",
      };
    default:
      return { title: "", body: "", url: "/" };
  }
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
    if (prefEnabledForKind(prefs, row.kind)) {
      const payload = buildPushPayload(row.kind, row.payload_json);
      if (payload.title || payload.body) {
        await sendPushToUser(row.user_id, payload);
      }
    }
    getDb()
      .prepare("UPDATE push_schedule SET sent_at = ? WHERE id = ?")
      .run(now, row.id);
  }
}

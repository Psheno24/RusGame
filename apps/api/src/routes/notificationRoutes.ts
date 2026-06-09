import type { FastifyInstance } from "fastify";
import {
  deletePushSubscription,
  getNotificationPrefs,
  getVapidPublicKey,
  updateNotificationPrefs,
  upsertPushSubscription,
} from "../pushNotifications.js";
import { resolveUserId } from "./shared.js";

export function registerNotificationRoutes(app: FastifyInstance): void {
  app.get("/api/notifications/vapid-public-key", async () => ({
    publicKey: getVapidPublicKey(),
  }));

  app.get("/api/notifications/prefs", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    return { prefs: getNotificationPrefs(userId) };
  });

  app.patch<{
    Body: { shiftReady?: boolean; housingPayment?: boolean; relocation?: boolean };
  }>("/api/notifications/prefs", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const body = req.body ?? {};
    const prefs = updateNotificationPrefs(userId, {
      shiftReady: typeof body.shiftReady === "boolean" ? body.shiftReady : undefined,
      housingPayment:
        typeof body.housingPayment === "boolean" ? body.housingPayment : undefined,
      relocation: typeof body.relocation === "boolean" ? body.relocation : undefined,
    });
    return { prefs };
  });

  app.put<{ Body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } }>(
    "/api/notifications/subscription",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      const endpoint = req.body?.endpoint?.trim();
      const p256dh = req.body?.keys?.p256dh?.trim();
      const auth = req.body?.keys?.auth?.trim();
      if (!endpoint || !p256dh || !auth) {
        return reply.code(400).send({ error: "Некорректная подписка" });
      }
      upsertPushSubscription(userId, { endpoint, keys: { p256dh, auth } });
      return { ok: true };
    },
  );

  app.delete<{ Body: { endpoint?: string } }>(
    "/api/notifications/subscription",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      const endpoint = req.body?.endpoint?.trim();
      if (!endpoint) return reply.code(400).send({ error: "Укажите endpoint" });
      deletePushSubscription(userId, endpoint);
      return { ok: true };
    },
  );
}

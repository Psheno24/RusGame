import type { FastifyInstance } from "fastify";
import { getPublicUser } from "../auth.js";
import { findCityJob } from "../gameData.js";
import { jobCityId } from "../jobLocation.js";
import { applyJob, doJobWork, quitJob } from "../game.js";
import { refreshPlayerState } from "../playerSync.js";
import {
  getTaxiStatus,
  taxiAcceptOrder,
  taxiClearCar,
  taxiDeclineOrder,
  taxiGoOffline,
  taxiGoOnline,
  taxiSelectCar,
} from "../taxi.js";
import { resolveUserId } from "./shared.js";

export function registerWorkRoutes(app: FastifyInstance): void {
  app.post("/api/work/quit", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const body = req.body as { jobId?: string };
    const jobId = body.jobId ?? "";
    if (!jobId) return reply.code(400).send({ error: "Укажите вакансию" });
    const result = quitJob(userId, jobId);
    if (!result.ok) {
      return reply.code(400).send({ error: result.error, remainingMs: result.remainingMs });
    }
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post("/api/work/apply", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const body = req.body as { jobId?: string; forceSwitch?: boolean };
    const jobId = body.jobId ?? "";
    if (!jobId) return reply.code(400).send({ error: "Укажите вакансию" });
    const result = applyJob(userId, jobId, { forceSwitch: body.forceSwitch === true });
    if (!result.ok) {
      if ("kind" in result) {
        return reply.code(409).send({
          code: "confirm_switch",
          jobId: result.jobId,
          currentTitle: result.currentTitle,
          newTitle: result.newTitle,
        });
      }
      const code = "code" in result ? result.code : undefined;
      return reply.code(code === "guest_no_housing" ? 403 : 400).send({
        error: result.error,
        remainingMs: result.remainingMs,
        code,
      });
    }
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post<{ Body: { jobId?: string; hours?: number } }>("/api/work/job", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const jobId = req.body?.jobId ?? "";
    if (!jobId) return reply.code(400).send({ error: "Укажите jobId" });
    const hours =
      req.body?.hours != null && Number.isFinite(Number(req.body.hours))
        ? Math.floor(Number(req.body.hours))
        : undefined;
    const result = doJobWork(userId, jobId, hours);
    if (!result.ok) {
      return reply.code(result.code === "guest_no_housing" ? 403 : 400).send({
        error: result.error,
        readyAt: result.readyAt,
        code: result.code,
        localTime: result.localTime,
        nextWindowAt: result.nextWindowAt,
      });
    }
    const user = await getPublicUser(userId);
    return { message: result.message, payout: result.payout, skillGain: result.skillGain, user };
  });

  app.get("/api/taxi/status", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    if (!player.job_id) return reply.code(400).send({ error: "Нет активной работы" });
    const job = findCityJob(jobCityId(player.job_id) ?? player.city_id, player.job_id);
    if (!job || job.kind !== "taxi_line") {
      return reply.code(400).send({ error: "Вы не устроены таксистом" });
    }
    const status = getTaxiStatus(player, job);
    const user = status.completedPayout != null ? await getPublicUser(userId) : undefined;
    return {
      ok: true,
      status,
      completedMessage: status.completedMessage,
      completedPayout: status.completedPayout,
      user,
    };
  });

  app.post("/api/taxi/clear-car", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const result = taxiClearCar(player);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post<{ Body: { carSource?: string; carRefId?: number } }>("/api/taxi/select-car", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const job = player.job_id ? findCityJob(jobCityId(player.job_id) ?? player.city_id, player.job_id) : null;
    if (!job || job.kind !== "taxi_line") {
      return reply.code(400).send({ error: "Вы не устроены таксистом" });
    }
    const source = req.body?.carSource === "rental" ? "rental" : "owned";
    const refId = Number(req.body?.carRefId);
    if (!Number.isFinite(refId)) return reply.code(400).send({ error: "Укажите автомобиль" });
    const result = taxiSelectCar(player, source, refId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post("/api/taxi/go-online", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const job = player.job_id ? findCityJob(jobCityId(player.job_id) ?? player.city_id, player.job_id) : null;
    if (!job || job.kind !== "taxi_line") {
      return reply.code(400).send({ error: "Вы не устроены таксистом" });
    }
    const result = taxiGoOnline(player, job);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post("/api/taxi/go-offline", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const result = taxiGoOffline(player);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post<{ Body: { orderId?: string } }>("/api/taxi/accept", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const orderId = req.body?.orderId ?? "";
    if (!orderId) return reply.code(400).send({ error: "Укажите заказ" });
    const job = player.job_id ? findCityJob(jobCityId(player.job_id) ?? player.city_id, player.job_id) : null;
    if (!job || job.kind !== "taxi_line") {
      return reply.code(400).send({ error: "Вы не устроены таксистом" });
    }
    const result = taxiAcceptOrder(player, job, orderId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post<{ Body: { orderId?: string } }>("/api/taxi/decline", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const orderId = req.body?.orderId ?? "";
    if (!orderId) return reply.code(400).send({ error: "Укажите заказ" });
    const result = taxiDeclineOrder(player, orderId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });
}

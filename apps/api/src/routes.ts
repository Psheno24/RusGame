import type { FastifyInstance, FastifyRequest } from "fastify";
import { ADMIN_LOGIN, ADMIN_PASSWORD } from "./config.js";
import {
  buildSession,
  createRefreshToken,
  getPublicUser,
  loginUser,
  persistRefreshToken,
  REFRESH_COOKIE,
  refreshCookieOptions,
  registerUser,
  revokeAllSessions,
  revokeRefreshToken,
  serializePlayer,
  signAccessToken,
  validateRefreshToken,
  verifyAccessToken,
} from "./auth.js";
import { getDb, getPlayer, getUserById, listPlayersForAdmin, updatePlayer } from "./db.js";
import { listCityFeed } from "./cityFeed.js";
import { getCities, getCity, getCityJobs, getPhones, getTravel } from "./gameData.js";
import {
  buyCar,
  buyPhoneDevice,
  doShift,
  doSideGig,
  formatCooldown,
  resolveTravel,
  SHOP_PRICES,
  startTravel,
} from "./game.js";
import { changeSimPart, registerSim, SIM_SHOP_PRICES, topupSim } from "./simShop.js";
import { formatSimFromPlayer, playerHasSim } from "./simNumber.js";

function getBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

/** Bearer или cookie сессии — для локальной игры без сбоев «Не авторизован». */
async function resolveUserId(req: FastifyRequest): Promise<number | null> {
  const token = getBearer(req);
  if (token) {
    const id = await verifyAccessToken(token);
    if (id) return id;
  }
  const raw = req.cookies[REFRESH_COOKIE];
  if (raw) return validateRefreshToken(raw);
  return null;
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({ ok: true }));

  app.post<{ Body: { login?: string; password?: string } }>("/api/auth/register", async (req, reply) => {
    const { login = "", password = "" } = req.body ?? {};
    const result = registerUser(login, password);
    if (!result.ok) return reply.code(400).send({ error: result.error });

    const refreshToken = result.refreshToken;
    const accessToken = await signAccessToken(result.userId);
    reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(90 * 24 * 60 * 60));
    return { accessToken, user: await getPublicUser(result.userId) };
  });

  app.post<{ Body: { login?: string; password?: string } }>("/api/auth/login", async (req, reply) => {
    const { login = "", password = "" } = req.body ?? {};
    const result = await loginUser(login, password);
    if (!result.ok) return reply.code(401).send({ error: result.error });

    reply.setCookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(90 * 24 * 60 * 60));
    return { accessToken: result.accessToken, user: await getPublicUser(result.userId) };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (raw) revokeRefreshToken(raw);
    reply.clearCookie(REFRESH_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.post("/api/auth/refresh", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) return reply.code(401).send({ error: "Нет сессии" });
    const userId = validateRefreshToken(raw);
    if (!userId) {
      reply.clearCookie(REFRESH_COOKIE, { path: "/" });
      return reply.code(401).send({ error: "Сессия истекла" });
    }
    const user = getUserById(userId);
    if (user?.is_banned) {
      return reply.code(403).send({ error: "Аккаунт заблокирован" });
    }
    const session = await buildSession(userId, raw);
    return { accessToken: session.accessToken, user: await getPublicUser(userId) };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const user = await getPublicUser(userId);
    if (!user) return reply.code(401).send({ error: "Не авторизован" });
    const accessToken = await signAccessToken(userId);
    return { user, accessToken };
  });

  app.get("/api/map/cities", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });

    let player = getPlayer(userId);
    if (player) player = resolveTravel(player);

    const cities = getCities().map((c) => ({
      id: c.id,
      name: c.name,
      tier: c.tier,
      mapX: c.mapX,
      mapY: c.mapY,
      playable: c.playable,
    }));

    return {
      cities,
      currentCityId: player?.city_id,
      status: player?.status,
      travelToCityId: player?.travel_to_city_id,
      travelArrivesAt: player?.travel_arrives_at,
    };
  });

  app.get("/api/city", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });

    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);

    const city = getCity(player.city_id);
    const jobs = getCityJobs(player.city_id);
    const now = Date.now();

    const sideCd = formatCooldown(player.side_gig_ready_at, now);
    const shiftCd = formatCooldown(player.shift_ready_at, now);

    return {
      city: city ? { id: city.id, name: city.name, tier: city.tier, playable: city.playable } : null,
      player: serializePlayer(player),
      jobs: jobs
        ? {
            sideGig: { ...jobs.sideGig, cooldown: sideCd },
            shift: { ...jobs.shift, cooldown: shiftCd },
          }
        : null,
      traveling: player.status === "traveling",
      travelArrivesAt: player.travel_arrives_at,
      feed: listCityFeed(player.city_id),
    };
  });

  app.post("/api/work/side-gig", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const result = doSideGig(userId);
    if (!result.ok) return reply.code(400).send({ error: result.error, readyAt: result.readyAt });
    const user = await getPublicUser(userId);
    return { message: result.message, payout: result.payout, user };
  });

  app.post("/api/work/shift", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const result = doShift(userId);
    if (!result.ok) return reply.code(400).send({ error: result.error, readyAt: result.readyAt });
    const user = await getPublicUser(userId);
    return { message: result.message, payout: result.payout, skillGain: result.skillGain, user };
  });

  app.get<{ Querystring: { to?: string } }>("/api/travel/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const to = req.query.to ?? "";
    const route = getTravel(player.city_id, to);
    if (!route) return reply.code(400).send({ error: "Маршрут недоступен" });
    const dest = getCity(to);
    return {
      from: player.city_id,
      to,
      toName: dest?.name,
      priceRub: route.priceRub,
      durationMs: route.durationMs,
    };
  });

  app.post<{ Body: { toCityId?: string } }>("/api/travel/start", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const to = req.body?.toCityId ?? "";
    const result = startTravel(userId, to);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { arrivesAt: result.arrivesAt, priceRub: result.priceRub, user };
  });

  app.get("/api/shop/prices", async () => ({ ...SHOP_PRICES, sim: SIM_SHOP_PRICES }));

  app.get("/api/shop/sim", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    return {
      prices: SIM_SHOP_PRICES,
      hasPhoneDevice: Boolean(player.phone_device_id),
      hasSim: playerHasSim(player),
      number: formatSimFromPlayer(player),
      simBalanceRub: Math.floor(player.sim_balance_rub ?? 0),
    };
  });

  app.get("/api/shop/phones", async () => ({
    phones: getPhones().map((d) => ({
      id: d.id,
      brand: d.brand,
      model: d.model,
      priceRub: d.priceRub,
      accent: d.accent,
      screen: d.screen,
      ram: d.ram,
      storage: d.storage,
      battery: d.battery,
      camera: d.camera,
      os: d.os,
    })),
  }));

  app.post<{ Body: { deviceId?: string } }>("/api/shop/phone", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const deviceId = req.body?.deviceId ?? "";
    const result = buyPhoneDevice(userId, deviceId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { deviceName: result.deviceName, user };
  });

  app.post("/api/shop/sim/register", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const result = registerSim(userId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { number: result.number, user };
  });

  app.post<{ Body: { part?: string } }>("/api/shop/sim/change", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const part = req.body?.part;
    if (part !== "operator" && part !== "mid" && part !== "last") {
      return reply.code(400).send({ error: "Укажите part: operator, mid или last" });
    }
    const result = changeSimPart(userId, part);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { number: result.number, user };
  });

  app.post<{ Body: { amount?: number } }>("/api/shop/sim/topup", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const result = topupSim(userId, Number(req.body?.amount));
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { simBalanceRub: result.simBalance, user };
  });

  app.post("/api/shop/car", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const result = buyCar(userId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { plate: result.plate, user };
  });

  // ——— Admin ———
  app.post("/api/admin/seed", async (req, reply) => {
    const existing = getDb().prepare("SELECT id FROM users WHERE is_admin = 1").get();
    if (existing) return reply.code(400).send({ error: "Админ уже создан" });
    const result = registerUser(ADMIN_LOGIN, ADMIN_PASSWORD, true);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    getDb().prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(result.userId);
    return { ok: true, login: ADMIN_LOGIN, hint: "Смените пароль через .env" };
  });

  app.get("/api/admin/players", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const u = getUserById(userId);
    if (!u?.is_admin) return reply.code(403).send({ error: "Только админ" });
    return { players: listPlayersForAdmin().map((p) => ({ login: p.login, ...serializePlayer(p) })) };
  });

  app.post<{ Body: { login?: string; rubles?: number; banned?: boolean } }>(
    "/api/admin/patch",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      const admin = getUserById(userId);
      if (!admin?.is_admin) return reply.code(403).send({ error: "Только админ" });

      const targetLogin = req.body?.login?.trim();
      if (!targetLogin) return reply.code(400).send({ error: "Укажите login" });

      const target = getDb().prepare("SELECT * FROM users WHERE login = ? COLLATE NOCASE").get(targetLogin) as
        | { id: number }
        | undefined;
      if (!target) return reply.code(404).send({ error: "Игрок не найден" });

      if (typeof req.body?.rubles === "number") {
        updatePlayer(target.id, { rubles: req.body.rubles });
      }
      if (typeof req.body?.banned === "boolean") {
        getDb().prepare("UPDATE users SET is_banned = ? WHERE id = ?").run(req.body.banned ? 1 : 0, target.id);
        if (req.body.banned) revokeAllSessions(target.id);
      }
      return { ok: true };
    },
  );
}

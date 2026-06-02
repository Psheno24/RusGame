import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  ADMIN_LOGIN,
  ADMIN_PASSWORD,
  LOCAL_DEV,
  ENABLE_TEST_ACCOUNT,
  TEST_COOLDOWN_SEC,
  TEST_LOGIN,
  TEST_PASSWORD,
} from "./config.js";
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
import { countPlayersInCity, getDb, getPlayer, getUserById, getUserByLogin, listPlayersForAdmin, updatePlayer } from "./db.js";
import { getCityLocalTime, getCityTimezone } from "./cityTime.js";
import { getShiftDurationLabel, isNightGuardJob, jobNominalCooldownMs, scaleNightGuardPayoutRange } from "./jobShift.js";
import {
  findCityJob,
  getCars,
  getCities,
  getCity,
  getCityJobs,
  getPhones,
  getTravel,
  getTravelOptions,
  getVehicleRentals,
  type JobDef,
} from "./gameData.js";
import {
  applyJob,
  buyCar,
  buyDriverLicenseCategory,
  buyDriversLicense,
  buyPhoneDevice,
  doJobWork,
  enrichJobWorkState,
  getDriverLicenseShop,
  listCarsInCategory,
  listCarCategoriesWithCounts,
  listOwnedCars,
  listPhoneCatalog,
  quoteCarPurchase,
  quoteCarSell,
  quotePhonePurchase,
  quotePhoneSell,
  quitJob,
  resolveTravel,
  sellCar,
  tradeInForCar,
  sellPhoneDevice,
  SHOP_PRICES,
  startTravel,
} from "./game.js";
import { changeSimPart, registerSim, SIM_SHOP_PRICES, topupSim } from "./simShop.js";
import {
  getSimTariffStatus,
  listTariffsForCity,
  quoteSimTariff,
  selectSimTariff,
  syncPlayerSimTariffBilling,
} from "./simTariff.js";
import { listActionPreviews, performAction } from "./actions.js";
import { buyProduct, listProductPreviews, listProducts } from "./products.js";
import {
  getHousingInfo,
  housingStatusForPlayer,
  payHousingDorm,
  payHousingRent,
  payLiveHere,
  quoteHousingBuyDetailed,
  quoteHousingSellById,
  quoteLiveHere,
  sellOwnedHousing,
} from "./housing.js";
import {
  afterBuyHousingChoice,
  buyHousingCash,
  buyHousingWithSell,
  listOwnedForExchange,
  quoteHousingPurchase,
} from "./housingShop.js";
import { jobAccessStatus, jobCityId } from "./jobLocation.js";
import {
  changePlateDigits,
  changePlateLetters,
  changePlateRegion,
  getPlateGarageList,
  getPlateShopViewForCar,
  registerVehiclePlate,
} from "./plateShop.js";
import { rentVehicle } from "./vehicleRent.js";
import { buildPropertyCards } from "./playerProperty.js";
import {
  getPropertyDetail,
  getPropertySellQuote,
  sellPropertyById,
} from "./propertyDetail.js";
import { activeJobShiftBlock, jobCooldownState, lastWorkRecordForJob } from "./workCooldown.js";
import { ensureTestAccount, isTestUser, scaleCooldownMs, scaleTravelMs } from "./testAccount.js";
import { listAccountsForTestAdmin, resetPlayerAccount } from "./playerReset.js";
import { listCityFeed } from "./cityFeed.js";
import { listPlayerFeed } from "./playerFeed.js";
import { formatSimFromPlayer, playerHasSim } from "./simNumber.js";
import { refreshPlayerState } from "./playerSync.js";

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

    const now = Date.now();
    const shiftBlock = player ? activeJobShiftBlock(player, now) : { blocked: false, remainingMs: 0 };
    const cities = getCities().map((c) => {
      const timezone = getCityTimezone(c);
      const localTime = getCityLocalTime(timezone, now);
      return {
        id: c.id,
        name: c.name,
        tier: c.tier,
        mapX: c.mapX,
        mapY: c.mapY,
        playable: c.playable,
        timezone,
        localTimeLabel: localTime.label,
      };
    });

    return {
      cities,
      currentCityId: player?.city_id,
      status: player?.status,
      travelToCityId: player?.travel_to_city_id,
      travelArrivesAt: player?.travel_arrives_at,
      jobShiftBlocked: shiftBlock.blocked,
      jobShiftRemainingMs: shiftBlock.remainingMs,
    };
  });

  app.get("/api/city", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });

    let player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });

    const city = getCity(player.city_id);
    const cityJobs = getCityJobs(player.city_id);
    const now = Date.now();
    const timezone = getCityTimezone(city);
    const localTime = getCityLocalTime(timezone, now);

    const jobPayload = (job: JobDef) => {
      const work = enrichJobWorkState(timezone, job, now);
      const cooldown = jobCooldownState(player, job, now);
      const record = lastWorkRecordForJob(player, job.id);
      const baseCooldownMs =
        record?.cooldownMs ?? jobNominalCooldownMs(job, work.localTime);
      let payoutMin =
        job.kind === "duration"
          ? (job.payoutPerHourMin ?? 0) * (job.shiftHoursMin ?? 4)
          : job.kind === "taxi_line"
            ? (job.payoutMin ?? 0)
            : (job.payoutMin ?? 0);
      let payoutMax =
        job.kind === "duration"
          ? (job.payoutPerHourMax ?? 0) * (job.shiftHoursMax ?? 12)
          : job.kind === "taxi_line"
            ? (job.payoutMax ?? 0)
            : (job.payoutMax ?? 0);
      if (isNightGuardJob(job)) {
        const shiftHours =
          jobNominalCooldownMs(job, work.localTime) / 3_600_000;
        const scaled = scaleNightGuardPayoutRange(job.payoutMin ?? 0, job.payoutMax ?? 0, shiftHours);
        payoutMin = scaled.min;
        payoutMax = scaled.max;
      }
      const workCityId = city?.id ?? player.city_id;
      const access = jobAccessStatus(player, job.id, now);
      return {
        id: job.id,
        templateKey: job.templateKey,
        title: job.title,
        workCityId,
        workCityName: access.workCityName,
        physicallyHere: access.physicallyHere,
        residentHere: access.residentHere,
        description: job.description,
        kind: job.kind,
        shiftHoursMin: job.shiftHoursMin ?? null,
        shiftHoursMax: job.shiftHoursMax ?? null,
        shiftHours: job.shiftHours ?? null,
        shiftEndsAtHour: job.shiftEndsAtHour ?? null,
        shiftDurationLabel: getShiftDurationLabel(job, cooldown.ready ? work.localTime : undefined),
        payoutPerHourMin: job.payoutPerHourMin ?? null,
        payoutPerHourMax: job.payoutPerHourMax ?? null,
        payoutMin,
        payoutMax,
        cooldownMs: baseCooldownMs,
        skill: job.skill,
        skillMin: job.skillMin,
        skillGain: job.skillGain,
        requiresPhone: job.requiresPhone === true || job.requiresSim === true,
        requiresSimTariff: job.requiresSimTariff ?? null,
        requiresDriversLicense: job.requiresDriversLicense ?? false,
        requiresCar: job.requiresCar ?? false,
        taxiTargetIncomeRub: job.taxiTargetIncomeRub ?? null,
        schedule: job.schedule,
        payoutPeriods: job.payoutPeriods,
        cooldown,
        scheduleAllowed: work.scheduleAllowed,
        payoutMultiplier: work.payoutMultiplier,
        scheduleHint: work.scheduleHint,
        nextWindowAt: work.nextWindowAt,
        lastShiftHours: job.kind === "duration" && record ? Math.round(record.cooldownMs / 3600000) : null,
      };
    };

    const housing = housingStatusForPlayer(player, now);

    let activeEmployment: {
      job: ReturnType<typeof jobPayload>;
      workCityId: string;
      workCityName: string;
      physicallyHere: boolean;
      residentHere: boolean;
      workBlockedReason: string | null;
    } | null = null;
    if (player.job_id) {
      const wc = jobCityId(player.job_id);
      const aj = wc ? findCityJob(wc, player.job_id) : null;
      if (aj && wc) {
        const access = jobAccessStatus(player, player.job_id, now);
        activeEmployment = {
          job: jobPayload(aj),
          workCityId: wc,
          workCityName: access.workCityName ?? wc,
          physicallyHere: access.physicallyHere,
          residentHere: access.residentHere,
          workBlockedReason: access.error,
        };
      }
    }

    return {
      city: city
        ? {
            id: city.id,
            name: city.name,
            tier: city.tier,
            playable: city.playable,
            population: countPlayersInCity(player.city_id),
            timezone,
            localTime,
            isResident: housing.isResident,
          }
        : null,
      player: serializePlayer(player),
      housing: getHousingInfo(player, now),
      jobs: cityJobs.length > 0 ? cityJobs.map(jobPayload) : null,
      activeEmployment,
      traveling: player.status === "traveling",
      travelArrivesAt: player.travel_arrives_at,
      feed: city ? listCityFeed(city.id) : [],
      actions: listActionPreviews(player),
    };
  });

  app.post<{ Params: { actionId?: string } }>("/api/action/:actionId", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const actionId = req.params.actionId ?? "";
    const result = performAction(userId, actionId);
    if (!result.ok) return reply.code(400).send({ error: result.error, code: result.code });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.get("/api/housing", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const info = getHousingInfo(player);
    if (!info?.ok) return reply.code(400).send({ error: info?.error ?? "Ошибка" });
    return info;
  });

  app.post("/api/housing/dorm", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const result = payHousingDorm(player);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post("/api/housing/rent", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const result = payHousingRent(player);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.get<{ Querystring: { propertyId?: string } }>("/api/housing/buy/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const propertyId = req.query.propertyId ?? "";
    if (!propertyId) return reply.code(400).send({ error: "Укажите propertyId" });
    const quote = quoteHousingBuyDetailed(player, propertyId);
    if ("error" in quote) return reply.code(400).send({ error: quote.error });
    return quote;
  });

  app.get<{ Querystring: { ownedId?: string } }>("/api/housing/live/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const ownedId = Number(req.query.ownedId);
    if (!Number.isFinite(ownedId)) return reply.code(400).send({ error: "Укажите ownedId" });
    const quote = quoteLiveHere(player, ownedId);
    if ("error" in quote) return reply.code(400).send({ error: quote.error });
    return quote;
  });

  app.post<{ Body: { ownedId?: number } }>("/api/housing/live", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const ownedId = Number(req.body?.ownedId);
    if (!Number.isFinite(ownedId)) return reply.code(400).send({ error: "Укажите ownedId" });
    const result = payLiveHere(player, ownedId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.get<{ Querystring: { propertyId?: string; sellIds?: string } }>(
    "/api/housing/buy/exchange-quote",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      let player = getPlayer(userId);
      if (!player) return reply.code(404).send({ error: "Игрок не найден" });
      player = resolveTravel(player);
      const propertyId = req.query.propertyId ?? "";
      if (!propertyId) return reply.code(400).send({ error: "Укажите propertyId" });
      const sellIds = (req.query.sellIds ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      const quote = quoteHousingPurchase(player, propertyId, sellIds);
      if ("error" in quote) return reply.code(400).send({ error: quote.error });
      return quote;
    },
  );

  app.post<{ Body: { propertyId?: string; sellOwnedIds?: number[] } }>(
    "/api/housing/buy",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      let player = getPlayer(userId);
      if (!player) return reply.code(404).send({ error: "Игрок не найден" });
      player = resolveTravel(player);
      const propertyId = req.body?.propertyId ?? "";
      if (!propertyId) return reply.code(400).send({ error: "Укажите propertyId" });
      const sellIds = req.body?.sellOwnedIds ?? [];
      const result =
        sellIds.length > 0
          ? buyHousingWithSell(player, propertyId, sellIds)
          : buyHousingCash(player, propertyId);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      const user = await getPublicUser(userId);
      return {
        message: result.message,
        user,
        needsPostChoice: result.needsPostChoice,
        ownedId: result.ownedId,
      };
    },
  );

  app.post<{ Body: { ownedId?: number; mode?: string } }>("/api/housing/after-buy", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const ownedId = Number(req.body?.ownedId);
    const mode = req.body?.mode === "sublet" ? "sublet" : "live";
    if (!Number.isFinite(ownedId)) return reply.code(400).send({ error: "Укажите ownedId" });
    const result = afterBuyHousingChoice(player, ownedId, mode);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.get("/api/housing/owned", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    return { owned: listOwnedForExchange(player) };
  });

  app.get<{ Querystring: { ownedId?: string } }>("/api/housing/sell/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const ownedId = Number(req.query.ownedId);
    if (!Number.isFinite(ownedId)) return reply.code(400).send({ error: "Укажите ownedId" });
    const quote = quoteHousingSellById(player, ownedId);
    if ("error" in quote) return reply.code(400).send({ error: quote.error });
    return quote;
  });

  app.post<{ Body: { ownedId?: number } }>("/api/housing/sell", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    const ownedId = req.body?.ownedId != null ? Number(req.body.ownedId) : undefined;
    const result = sellOwnedHousing(player, ownedId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

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
    const { getTaxiStatus } = await import("./taxi.js");
    return { ok: true, status: getTaxiStatus(player, job) };
  });

  app.post<{ Body: { carSource?: string; carRefId?: number } }>("/api/taxi/go-online", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const job = player.job_id ? findCityJob(jobCityId(player.job_id) ?? player.city_id, player.job_id) : null;
    if (!job || job.kind !== "taxi_line") {
      return reply.code(400).send({ error: "Вы не устроены таксистом" });
    }
    const source = req.body?.carSource === "rental" ? "rental" : "owned";
    const refId = Number(req.body?.carRefId);
    if (!Number.isFinite(refId)) return reply.code(400).send({ error: "Укажите автомобиль" });
    const { taxiGoOnline } = await import("./taxi.js");
    const result = taxiGoOnline(player, source, refId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post("/api/taxi/go-offline", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const { taxiGoOffline } = await import("./taxi.js");
    const result = taxiGoOffline(player);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.post("/api/taxi/accept", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const job = player.job_id ? findCityJob(jobCityId(player.job_id) ?? player.city_id, player.job_id) : null;
    if (!job || job.kind !== "taxi_line") {
      return reply.code(400).send({ error: "Вы не устроены таксистом" });
    }
    const { taxiAcceptOrder } = await import("./taxi.js");
    const result = taxiAcceptOrder(player, job);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, payout: result.payout, user };
  });

  app.post("/api/taxi/decline", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const { taxiDeclineOrder } = await import("./taxi.js");
    const result = taxiDeclineOrder(player);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.get<{ Querystring: { to?: string } }>("/api/travel/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const to = req.query.to ?? "";
    const options = getTravelOptions(player.city_id, to);
    if (options.length === 0) return reply.code(400).send({ error: "Маршрут недоступен" });
    const dest = getCity(to);
    return {
      from: player.city_id,
      to,
      toName: dest?.name,
      options: options.map((o) => ({
        mode: o.mode,
        priceRub: o.priceRub,
        durationMs: scaleTravelMs(o.durationMs, userId),
      })),
    };
  });

  app.post<{ Body: { toCityId?: string; mode?: string } }>("/api/travel/start", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const to = req.body?.toCityId ?? "";
    const mode = req.body?.mode === "plane" ? "plane" : "train";
    const result = startTravel(userId, to, mode);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { arrivesAt: result.arrivesAt, priceRub: result.priceRub, user };
  });

  app.get("/api/shop/prices", async () => ({ ...SHOP_PRICES, sim: SIM_SHOP_PRICES }));

  app.get("/api/player/property", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    return { cards: buildPropertyCards(player) };
  });

  app.get("/api/player/feed", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    return { events: listPlayerFeed(userId) };
  });

  app.get<{ Params: { propertyId?: string } }>("/api/player/property/:propertyId", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = refreshPlayerState(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const propertyId = decodeURIComponent(req.params.propertyId ?? "");
    const detail = getPropertyDetail(player, propertyId);
    if ("error" in detail) return reply.code(404).send({ error: detail.error });
    return detail;
  });

  app.get<{ Params: { propertyId?: string } }>(
    "/api/player/property/:propertyId/sell-quote",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      const player = refreshPlayerState(userId);
      if (!player) return reply.code(404).send({ error: "Игрок не найден" });
      const propertyId = decodeURIComponent(req.params.propertyId ?? "");
      const quote = getPropertySellQuote(player, propertyId);
      if ("error" in quote) return reply.code(400).send({ error: quote.error });
      return quote;
    },
  );

  app.post<{ Params: { propertyId?: string } }>(
    "/api/player/property/:propertyId/sell",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      const propertyId = decodeURIComponent(req.params.propertyId ?? "");
      const result = sellPropertyById(userId, propertyId);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      const user = await getPublicUser(userId);
      return { message: result.message, receiveRub: result.receiveRub, user };
    },
  );

  app.get("/api/shop/car-categories", async () => ({
    categories: listCarCategoriesWithCounts(),
  }));

  app.get<{ Querystring: { category?: string } }>("/api/shop/cars", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const category = req.query.category ?? "B";
    return {
      category,
      cars: listCarsInCategory(player, category),
      ownedCars: listOwnedCars(player),
    };
  });

  app.get("/api/shop/vehicle-rentals", async () => ({ rentals: getVehicleRentals() }));

  app.get<{ Querystring: { carId?: string; tradeInIds?: string } }>(
    "/api/shop/car/quote",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      const player = getPlayer(userId);
      if (!player) return reply.code(404).send({ error: "Игрок не найден" });
      const carId = req.query.carId ?? "";
      if (!carId) return reply.code(400).send({ error: "Укажите carId" });
      const tradeInIds = (req.query.tradeInIds ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      const quote = quoteCarPurchase(player, carId, tradeInIds);
      if ("error" in quote) return reply.code(400).send({ error: quote.error });
      return quote;
    },
  );

  app.get<{ Querystring: { playerCarId?: string } }>("/api/shop/plate", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const raw = req.query.playerCarId;
    if (raw) {
      const playerCarId = Number(raw);
      if (!Number.isInteger(playerCarId) || playerCarId <= 0) {
        return reply.code(400).send({ error: "Некорректный playerCarId" });
      }
      const view = getPlateShopViewForCar(player, playerCarId);
      if ("error" in view) return reply.code(400).send({ error: view.error });
      return view;
    }
    return { cars: getPlateGarageList(player) };
  });

  app.get("/api/shop/products", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    let player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    player = resolveTravel(player);
    return {
      products: listProducts(),
      previews: listProductPreviews(player),
    };
  });

  app.post<{ Body: { productId?: string } }>("/api/shop/product", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const productId = req.body?.productId ?? "";
    if (!productId) return reply.code(400).send({ error: "Укажите productId" });
    const result = buyProduct(userId, productId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { message: result.message, user };
  });

  app.get("/api/shop/sim", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = syncPlayerSimTariffBilling(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const tariff = getSimTariffStatus(player);
    return {
      prices: SIM_SHOP_PRICES,
      hasPhoneDevice: Boolean(player.phone_device_id),
      hasSim: playerHasSim(player),
      number: formatSimFromPlayer(player),
      simBalanceRub: Math.floor(player.sim_balance_rub ?? 0),
      tariff: {
        id: tariff.tariffId,
        title: tariff.tariffTitle,
        pendingId: tariff.pendingId,
        pendingTitle: tariff.pendingTitle,
        paidUntil: tariff.paidUntil,
        paidUntilLabel: tariff.paidUntilLabel,
        pendingEffectiveLabel: tariff.pendingEffectiveLabel,
      },
      tariffs: listTariffsForCity(player.city_id),
      cityName: getCity(player.city_id)?.name ?? player.city_id,
    };
  });

  app.get<{ Querystring: { planId?: string } }>("/api/shop/sim/tariff/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = syncPlayerSimTariffBilling(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const planId = req.query.planId ?? "";
    if (!planId) return reply.code(400).send({ error: "Укажите planId" });
    const quote = quoteSimTariff(player, planId);
    if ("error" in quote) return reply.code(400).send({ error: quote.error });
    return quote;
  });

  app.post<{ Body: { planId?: string } }>("/api/shop/sim/tariff", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const planId = req.body?.planId ?? "";
    if (!planId) return reply.code(400).send({ error: "Укажите planId" });
    const result = selectSimTariff(userId, planId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { planId: result.planId, paidUntil: result.paidUntil, user };
  });

  app.get("/api/shop/phones", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    return { phones: listPhoneCatalog(player) };
  });

  app.get<{ Querystring: { deviceId?: string } }>("/api/shop/phone/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const deviceId = req.query.deviceId ?? "";
    if (!deviceId) return reply.code(400).send({ error: "Укажите deviceId" });
    const quote = quotePhonePurchase(player, deviceId);
    if ("error" in quote) return reply.code(400).send({ error: quote.error });
    return quote;
  });

  app.post<{ Body: { deviceId?: string } }>("/api/shop/phone", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const deviceId = req.body?.deviceId ?? "";
    const result = buyPhoneDevice(userId, deviceId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { deviceName: result.deviceName, tradeInRub: result.tradeInRub, user };
  });

  app.get("/api/shop/phone/sell/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const quote = quotePhoneSell(player);
    if ("error" in quote) return reply.code(400).send({ error: quote.error });
    return quote;
  });

  app.post("/api/shop/phone/sell", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const result = sellPhoneDevice(userId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { amountRub: result.amountRub, user };
  });

  app.get<{ Querystring: { playerCarId?: string } }>("/api/shop/car/sell/quote", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const player = getPlayer(userId);
    if (!player) return reply.code(404).send({ error: "Игрок не найден" });
    const playerCarId = Number(req.query.playerCarId);
    if (!Number.isInteger(playerCarId) || playerCarId <= 0) {
      return reply.code(400).send({ error: "Укажите playerCarId" });
    }
    const quote = quoteCarSell(player, playerCarId);
    if ("error" in quote) return reply.code(400).send({ error: quote.error });
    return quote;
  });

  app.post<{ Body: { playerCarId?: number } }>("/api/shop/car/sell", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const playerCarId = req.body?.playerCarId;
    if (!playerCarId) return reply.code(400).send({ error: "Укажите playerCarId" });
    const result = sellCar(userId, playerCarId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { amountRub: result.amountRub, user };
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

  app.post<{ Body: { carId?: string } }>("/api/shop/car", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const carId = req.body?.carId ?? "";
    if (!carId) return reply.code(400).send({ error: "Укажите carId" });
    const result = buyCar(userId, carId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { carName: result.carName, user };
  });

  app.post<{ Body: { carId?: string; tradeInCarIds?: number[] } }>(
    "/api/shop/car/trade-in",
    async (req, reply) => {
      const userId = await resolveUserId(req);
      if (!userId) return reply.code(401).send({ error: "Не авторизован" });
      const carId = req.body?.carId ?? "";
      const tradeInCarIds = req.body?.tradeInCarIds ?? [];
      if (!carId) return reply.code(400).send({ error: "Укажите carId" });
      const result = tradeInForCar(userId, carId, tradeInCarIds);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      const user = await getPublicUser(userId);
      return { carName: result.carName, excessRub: result.excessRub, user };
    },
  );

  app.get("/api/police/licenses", async () => ({ licenses: getDriverLicenseShop() }));

  app.post<{ Body: { category?: string } }>("/api/police/license", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const category = req.body?.category ?? "";
    if (!category) return reply.code(400).send({ error: "Укажите category" });
    const result = buyDriverLicenseCategory(userId, category);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { user };
  });

  app.post<{ Body: { rentalId?: string } }>("/api/shop/vehicle-rent", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const rentalId = req.body?.rentalId ?? "";
    if (!rentalId) return reply.code(400).send({ error: "Укажите rentalId" });
    const result = rentVehicle(userId, rentalId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { label: result.label, expiresAt: result.expiresAt, user };
  });

  app.post<{ Body: { playerCarId?: number } }>("/api/shop/plate/register", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const playerCarId = req.body?.playerCarId;
    if (!playerCarId) return reply.code(400).send({ error: "Укажите playerCarId" });
    const result = registerVehiclePlate(userId, playerCarId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { plateText: result.plateText, user };
  });

  app.post<{ Body: { playerCarId?: number } }>("/api/shop/plate/digits", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const playerCarId = req.body?.playerCarId;
    if (!playerCarId) return reply.code(400).send({ error: "Укажите playerCarId" });
    const result = changePlateDigits(userId, playerCarId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { plateText: result.plateText, user };
  });

  app.post<{ Body: { playerCarId?: number } }>("/api/shop/plate/letters", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const playerCarId = req.body?.playerCarId;
    if (!playerCarId) return reply.code(400).send({ error: "Укажите playerCarId" });
    const result = changePlateLetters(userId, playerCarId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { plateText: result.plateText, user };
  });

  app.post<{ Body: { playerCarId?: number } }>("/api/shop/plate/region", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const playerCarId = req.body?.playerCarId;
    if (!playerCarId) return reply.code(400).send({ error: "Укажите playerCarId" });
    const result = changePlateRegion(userId, playerCarId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { plateText: result.plateText, user };
  });

  app.post("/api/shop/drivers-license", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    const result = buyDriversLicense(userId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    const user = await getPublicUser(userId);
    return { user };
  });

  if (LOCAL_DEV || ENABLE_TEST_ACCOUNT) {
    app.post("/api/dev/seed-test", async () => {
      const { created, login } = ensureTestAccount();
      return {
        ok: true,
        created,
        login,
        password: TEST_PASSWORD,
        hint: `Не в населении и ленте; любое КД — ${TEST_COOLDOWN_SEC} с`,
      };
    });
  }

  // ——— Test account admin ———
  app.get("/api/test/accounts", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    if (!isTestUser(userId)) return reply.code(403).send({ error: "Только тестовый аккаунт" });
    return { accounts: listAccountsForTestAdmin() };
  });

  app.post<{ Body: { login?: string } }>("/api/test/reset-account", async (req, reply) => {
    const userId = await resolveUserId(req);
    if (!userId) return reply.code(401).send({ error: "Не авторизован" });
    if (!isTestUser(userId)) return reply.code(403).send({ error: "Только тестовый аккаунт" });

    const login = req.body?.login?.trim();
    if (!login) return reply.code(400).send({ error: "Укажите login" });

    const target = getUserByLogin(login);
    if (!target) return reply.code(404).send({ error: "Пользователь не найден" });

    if (!resetPlayerAccount(target.id)) {
      return reply.code(404).send({ error: "Игрок не найден" });
    }

    return { ok: true, login: target.login };
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

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  buildSession,
  getPublicUser,
  loginUser,
  REFRESH_COOKIE,
  refreshCookieOptions,
  registerUser,
  revokeRefreshToken,
  signAccessToken,
  validateRefreshToken,
} from "../auth.js";
import { getUserById } from "../db.js";
import { resolveUserId } from "./shared.js";

const SESSION_BASES = ["/api/session", "/api/auth"] as const;

type LoginBody = { login?: string; password?: string };

async function handleRegister(
  req: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply,
) {
  const { login = "", password = "" } = req.body ?? {};
  const result = registerUser(login, password);
  if (!result.ok) return reply.code(400).send({ error: result.error });

  const refreshToken = result.refreshToken;
  const accessToken = await signAccessToken(result.userId);
  reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(90 * 24 * 60 * 60));
  return { accessToken, user: await getPublicUser(result.userId) };
}

async function handleLogin(req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
  const { login = "", password = "" } = req.body ?? {};
  const result = await loginUser(login, password);
  if (!result.ok) return reply.code(401).send({ error: result.error });

  reply.setCookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(90 * 24 * 60 * 60));
  return { accessToken: result.accessToken, user: await getPublicUser(result.userId) };
}

async function handleLogout(_req: FastifyRequest, reply: FastifyReply) {
  const raw = _req.cookies[REFRESH_COOKIE];
  if (raw) revokeRefreshToken(raw);
  reply.clearCookie(REFRESH_COOKIE, { path: "/" });
  return { ok: true };
}

async function handleRefresh(_req: FastifyRequest, reply: FastifyReply) {
  const raw = _req.cookies[REFRESH_COOKIE];
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
}

async function handleMe(req: FastifyRequest, reply: FastifyReply) {
  const userId = await resolveUserId(req);
  if (!userId) return reply.code(401).send({ error: "Не авторизован" });
  const user = await getPublicUser(userId);
  if (!user) return reply.code(401).send({ error: "Не авторизован" });
  const accessToken = await signAccessToken(userId);
  return { user, accessToken };
}

export function registerAuthRoutes(app: FastifyInstance): void {
  for (const base of SESSION_BASES) {
    app.post<{ Body: LoginBody }>(`${base}/register`, handleRegister);
    app.post<{ Body: LoginBody }>(`${base}/login`, handleLogin);
    app.post(`${base}/logout`, handleLogout);
    app.post(`${base}/refresh`, handleRefresh);
    app.get(`${base}/me`, handleMe);
  }
}

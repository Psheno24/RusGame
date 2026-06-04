import type { FastifyRequest } from "fastify";
import { REFRESH_COOKIE, validateRefreshToken, verifyAccessToken } from "../auth.js";

export function getBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

/** Bearer или cookie сессии — для локальной игры без сбоев «Не авторизован». */
export async function resolveUserId(req: FastifyRequest): Promise<number | null> {
  const token = getBearer(req);
  if (token) {
    const id = await verifyAccessToken(token);
    if (id) return id;
  }
  const raw = req.cookies[REFRESH_COOKIE];
  if (raw) return validateRefreshToken(raw);
  return null;
}

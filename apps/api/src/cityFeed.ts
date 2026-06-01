import { getDb, getPlayer } from "./db.js";
import { isTestUser } from "./testAccount.js";

export type CityFeedType =
  | "shop:plate"
  | "shop:rent"
  | "work:side"
  | "work:shift"
  | "travel:depart"
  | "travel:arrive"
  | "shop:car"
  | "shop:phone"
  | "shop:sim";

export type CityFeedEvent = {
  id: number;
  ts: number;
  type: CityFeedType;
  actorUserId: number | null;
  actorName: string;
  text: string;
};

const MAX_STORED = 50;
const DEFAULT_LIST = 12;

export function appendCityFeed(
  cityId: string,
  type: CityFeedType,
  text: string,
  actorUserId?: number,
  ts: number = Date.now(),
): CityFeedEvent | null {
  if (actorUserId != null && isTestUser(actorUserId)) return null;

  const player = actorUserId ? getPlayer(actorUserId) : undefined;
  const actorName = player?.display_name ?? "Игрок";
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO city_feed (city_id, ts, type, actor_user_id, actor_name, text)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(cityId, ts, type, actorUserId ?? null, actorName, text);

  const id = Number(r.lastInsertRowid);
  db.prepare(
    `DELETE FROM city_feed WHERE city_id = ? AND id NOT IN (
      SELECT id FROM city_feed WHERE city_id = ? ORDER BY ts DESC, id DESC LIMIT ?
    )`,
  ).run(cityId, cityId, MAX_STORED);

  return { id, ts, type, actorUserId: actorUserId ?? null, actorName, text };
}

export function listCityFeed(cityId: string, limit = DEFAULT_LIST): CityFeedEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT f.id, f.ts, f.type, f.actor_user_id AS actorUserId, f.actor_name AS actorName, f.text
       FROM city_feed f
       LEFT JOIN users u ON u.id = f.actor_user_id
       WHERE f.city_id = ? AND COALESCE(u.is_test, 0) = 0
       ORDER BY f.ts DESC, f.id DESC LIMIT ?`,
    )
    .all(cityId, limit) as CityFeedEvent[];
  return rows;
}

export function feedActorName(userId: number): string {
  return getPlayer(userId)?.display_name ?? "Игрок";
}

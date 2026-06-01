import { getDb } from "./db.js";

export type CityFeedType = "city:random";

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
  _actorUserId?: number,
  ts: number = Date.now(),
): CityFeedEvent {
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO city_feed (city_id, ts, type, actor_user_id, actor_name, text)
       VALUES (?, ?, ?, NULL, ?, ?)`,
    )
    .run(cityId, ts, type, "Город", text);

  const id = Number(r.lastInsertRowid);
  db.prepare(
    `DELETE FROM city_feed WHERE city_id = ? AND id NOT IN (
      SELECT id FROM city_feed WHERE city_id = ? ORDER BY ts DESC, id DESC LIMIT ?
    )`,
  ).run(cityId, cityId, MAX_STORED);

  return { id, ts, type, actorUserId: null, actorName: "Город", text };
}

/** Пока без автогенерации — лента пустая, события добавим позже. */
export function listCityFeed(_cityId: string, _limit = DEFAULT_LIST): CityFeedEvent[] {
  return [];
}

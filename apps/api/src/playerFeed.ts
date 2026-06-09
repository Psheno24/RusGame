import { getDb } from "./db.js";
import { isTestUser } from "./testAccount.js";

export type PlayerFeedType =
  | "shop:plate"
  | "shop:rent"
  | "work:side"
  | "work:shift"
  | "work:taxi"
  | "travel:depart"
  | "travel:arrive"
  | "shop:car"
  | "shop:phone"
  | "shop:sim"
  | "housing:buy"
  | "housing:sell"
  | "housing:live"
  | "housing:dorm"
  | "housing:rent"
  | "job:apply"
  | "job:quit"
  | "work:delivery"
  | "education:start"
  | "education:lesson"
  | "education:complete"
  | "education:dropout"
  | "career:promote"
  | "career:shift";

export type PlayerFeedEvent = {
  id: number;
  ts: number;
  type: PlayerFeedType;
  text: string;
};

const MAX_STORED = 80;
const DEFAULT_LIST = 40;

export function appendPlayerFeed(
  userId: number,
  type: PlayerFeedType,
  text: string,
  ts: number = Date.now(),
): PlayerFeedEvent | null {
  if (isTestUser(userId)) return null;

  const db = getDb();
  const r = db
    .prepare(`INSERT INTO player_feed (user_id, ts, type, text) VALUES (?, ?, ?, ?)`)
    .run(userId, ts, type, text);

  const id = Number(r.lastInsertRowid);
  db.prepare(
    `DELETE FROM player_feed WHERE user_id = ? AND id NOT IN (
      SELECT id FROM player_feed WHERE user_id = ? ORDER BY ts DESC, id DESC LIMIT ?
    )`,
  ).run(userId, userId, MAX_STORED);

  return { id, ts, type, text };
}

export function listPlayerFeed(userId: number, limit = DEFAULT_LIST): PlayerFeedEvent[] {
  return getDb()
    .prepare(
      `SELECT id, ts, type, text FROM player_feed
       WHERE user_id = ? ORDER BY ts DESC, id DESC LIMIT ?`,
    )
    .all(userId, limit) as PlayerFeedEvent[];
}

import { getDb } from "./db.js";

export type OwnedHousingRow = {
  id: number;
  user_id: number;
  city_id: string;
  property_id: string;
  acquired_at: number;
  sublet_from: number | null;
  sublet_until: number | null;
  sublet_income_rub: number;
  sublet_paid_rub: number;
  sublet_next_payout_at: number | null;
  sublet_retry_at: number | null;
  sublet_retry_chance: number | null;
};

const OWNED_SELECT = `SELECT id, user_id, city_id, property_id, acquired_at, sublet_from, sublet_until, sublet_income_rub,
              COALESCE(sublet_paid_rub, 0) AS sublet_paid_rub, sublet_next_payout_at,
              sublet_retry_at, sublet_retry_chance`;

export function listOwnedHousing(userId: number): OwnedHousingRow[] {
  return getDb()
    .prepare(
      `${OWNED_SELECT}
       FROM player_owned_housing WHERE user_id = ? ORDER BY acquired_at ASC`,
    )
    .all(userId) as OwnedHousingRow[];
}

export function getOwnedHousing(id: number, userId?: number): OwnedHousingRow | undefined {
  const row = getDb()
    .prepare(
      `${OWNED_SELECT}
       FROM player_owned_housing WHERE id = ?`,
    )
    .get(id) as OwnedHousingRow | undefined;
  if (!row) return undefined;
  if (userId != null && row.user_id !== userId) return undefined;
  return row;
}

export function findOwnedHousing(
  userId: number,
  cityId: string,
  propertyId: string,
): OwnedHousingRow | undefined {
  return getDb()
    .prepare(
      `${OWNED_SELECT}
       FROM player_owned_housing WHERE user_id = ? AND city_id = ? AND property_id = ?`,
    )
    .get(userId, cityId, propertyId) as OwnedHousingRow | undefined;
}

export function insertOwnedHousing(
  userId: number,
  cityId: string,
  propertyId: string,
  acquiredAt: number,
): number {
  const r = getDb()
    .prepare(
      `INSERT INTO player_owned_housing (user_id, city_id, property_id, acquired_at, sublet_from, sublet_until, sublet_income_rub)
       VALUES (?, ?, ?, ?, NULL, NULL, 0)`,
    )
    .run(userId, cityId, propertyId, acquiredAt);
  return Number(r.lastInsertRowid);
}

export function updateOwnedHousing(
  id: number,
  patch: Partial<
    Pick<
      OwnedHousingRow,
      | "sublet_from"
      | "sublet_until"
      | "sublet_income_rub"
      | "sublet_paid_rub"
      | "sublet_next_payout_at"
      | "sublet_retry_at"
      | "sublet_retry_chance"
    >
  >,
) {
  if (patch.sublet_from !== undefined) {
    getDb()
      .prepare("UPDATE player_owned_housing SET sublet_from = ? WHERE id = ?")
      .run(patch.sublet_from, id);
  }
  if (patch.sublet_until !== undefined) {
    getDb()
      .prepare("UPDATE player_owned_housing SET sublet_until = ? WHERE id = ?")
      .run(patch.sublet_until, id);
  }
  if (patch.sublet_income_rub !== undefined) {
    getDb()
      .prepare("UPDATE player_owned_housing SET sublet_income_rub = ? WHERE id = ?")
      .run(patch.sublet_income_rub, id);
  }
  if (patch.sublet_paid_rub !== undefined) {
    getDb()
      .prepare("UPDATE player_owned_housing SET sublet_paid_rub = ? WHERE id = ?")
      .run(patch.sublet_paid_rub, id);
  }
  if (patch.sublet_next_payout_at !== undefined) {
    getDb()
      .prepare("UPDATE player_owned_housing SET sublet_next_payout_at = ? WHERE id = ?")
      .run(patch.sublet_next_payout_at, id);
  }
  if (patch.sublet_retry_at !== undefined) {
    getDb()
      .prepare("UPDATE player_owned_housing SET sublet_retry_at = ? WHERE id = ?")
      .run(patch.sublet_retry_at, id);
  }
  if (patch.sublet_retry_chance !== undefined) {
    getDb()
      .prepare("UPDATE player_owned_housing SET sublet_retry_chance = ? WHERE id = ?")
      .run(patch.sublet_retry_chance, id);
  }
}

export function clearSublet(id: number) {
  updateOwnedHousing(id, {
    sublet_from: null,
    sublet_until: null,
    sublet_income_rub: 0,
    sublet_paid_rub: 0,
    sublet_next_payout_at: null,
    sublet_retry_at: null,
    sublet_retry_chance: null,
  });
}

export function deleteOwnedHousing(id: number, userId: number) {
  getDb()
    .prepare("DELETE FROM player_owned_housing WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

export function isSubletActive(row: OwnedHousingRow, now: number): boolean {
  return row.sublet_until != null && row.sublet_until > now;
}

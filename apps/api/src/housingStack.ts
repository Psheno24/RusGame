import type { HousingType, PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { getCity } from "./gameData.js";
import { getHousingProperty } from "./housingCatalog.js";
import { getOwnedHousing } from "./playerOwnedHousing.js";
import { clearSublet, listOwnedHousing } from "./playerOwnedHousing.js";

export type HousingStackEntry = {
  type: HousingType;
  cityId: string;
  ownedId?: number;
  propertyId?: string;
  expiresAt?: number | null;
};

export function parseHousingStack(raw: string | null | undefined): HousingStackEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HousingStackEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function entryKey(e: HousingStackEntry): string {
  if (e.type === "owned" && e.ownedId != null) return `owned:${e.ownedId}`;
  return `${e.type}:${e.cityId}:${e.expiresAt ?? 0}`;
}

export function pushHousingStack(
  stack: HousingStackEntry[],
  entry: HousingStackEntry,
): HousingStackEntry[] {
  const key = entryKey(entry);
  if (stack.some((s) => entryKey(s) === key)) return stack;
  return [...stack, entry];
}

export function saveHousingStack(userId: number, stack: HousingStackEntry[]) {
  updatePlayer(userId, { housing_stack: stack.length > 0 ? JSON.stringify(stack) : null });
}

export function snapshotToStack(player: PlayerRow): HousingStackEntry | null {
  if (!player.housing_type || !player.housing_city_id) return null;
  if (player.housing_type === "owned" && player.housing_owned_id != null) {
    return {
      type: "owned",
      cityId: player.housing_city_id,
      ownedId: player.housing_owned_id,
      propertyId: player.housing_property_id ?? undefined,
    };
  }
  return {
    type: player.housing_type as HousingType,
    cityId: player.housing_city_id,
    expiresAt: player.housing_expires_at,
    propertyId: player.housing_property_id ?? undefined,
  };
}

export function pushCurrentResidenceToStack(player: PlayerRow): HousingStackEntry[] {
  const entry = snapshotToStack(player);
  if (!entry) return parseHousingStack(player.housing_stack);
  const stack = pushHousingStack(parseHousingStack(player.housing_stack), entry);
  saveHousingStack(player.user_id, stack);
  return stack;
}

function applyOwnedResidencePatch(
  player: PlayerRow,
  row: { id: number; city_id: string; property_id: string; acquired_at: number },
): Partial<PlayerRow> {
  return {
    housing_type: "owned",
    housing_city_id: row.city_id,
    housing_property_id: row.property_id,
    housing_owned_id: row.id,
    housing_owned_at: row.acquired_at,
    housing_expires_at: null,
  };
}

function ownedResidenceLabel(row: { city_id: string; property_id: string }): string {
  const prop = getHousingProperty(row.city_id, row.property_id);
  const city = getCity(row.city_id);
  const name = prop?.title ?? row.property_id;
  return `${name} (${city?.name ?? row.city_id})`;
}

function stackEntryResidenceLabel(entry: HousingStackEntry): string {
  const city = getCity(entry.cityId);
  const cityName = city?.name ?? entry.cityId;
  if (entry.type === "owned") {
    if (entry.propertyId) {
      const prop = getHousingProperty(entry.cityId, entry.propertyId);
      return `${prop?.title ?? entry.propertyId} (${cityName})`;
    }
    return cityName;
  }
  const kind = entry.type === "rent" ? "Аренда" : "Общежитие";
  return `${kind} (${cityName})`;
}

export type NextResidence = { patch: Partial<PlayerRow>; label: string };

/** Следующее жильё после продажи текущего (предпросмотр и восстановление). */
export function findNextResidence(
  player: PlayerRow,
  now = Date.now(),
  opts?: { skipOwnedIds?: number[] },
): NextResidence | null {
  const skip = new Set(opts?.skipOwnedIds ?? []);
  const stack = parseHousingStack(player.housing_stack);

  for (const entry of stack) {
    if (entry.type === "owned" && entry.ownedId != null) {
      if (skip.has(entry.ownedId)) continue;
      const row = getOwnedHousing(entry.ownedId, player.user_id);
      if (!row) continue;
      return {
        patch: applyOwnedResidencePatch(player, row),
        label: ownedResidenceLabel(row),
      };
    }
    if (entry.type === "dorm" || entry.type === "rent") {
      if (entry.expiresAt != null && entry.expiresAt > now) {
        return {
          patch: {
            housing_type: entry.type,
            housing_city_id: entry.cityId,
            housing_expires_at: entry.expiresAt,
            housing_owned_id: null,
            housing_property_id: null,
            housing_owned_at: null,
          },
          label: stackEntryResidenceLabel(entry),
        };
      }
    }
  }

  for (const row of listOwnedHousing(player.user_id)) {
    if (skip.has(row.id)) continue;
    if (stack.some((e) => e.type === "owned" && e.ownedId === row.id)) continue;
    return {
      patch: applyOwnedResidencePatch(player, row),
      label: ownedResidenceLabel(row),
    };
  }

  return null;
}

/** Первое доступное жильё из цепочки (без повторений). */
export function restoreFromHousingStack(
  player: PlayerRow,
  now = Date.now(),
): { patch: Partial<PlayerRow>; label: string } | null {
  const next = findNextResidence(player, now);
  if (!next) return null;
  if (next.patch.housing_owned_id != null) {
    clearSublet(next.patch.housing_owned_id);
  }
  return next;
}

export function clearHousingStack(userId: number) {
  updatePlayer(userId, { housing_stack: null });
}

export function migrateLegacyHousingLast(player: PlayerRow): PlayerRow {
  if (player.housing_stack) return player;
  if (!player.housing_last_type) return player;
  const entry: HousingStackEntry =
    player.housing_last_type === "owned" && player.housing_last_owned_id != null
      ? {
          type: "owned",
          cityId: player.housing_last_city_id ?? player.city_id,
          ownedId: player.housing_last_owned_id,
          propertyId: player.housing_last_property_id ?? undefined,
        }
      : {
          type: player.housing_last_type as HousingType,
          cityId: player.housing_last_city_id ?? player.city_id,
          expiresAt: player.housing_last_expires_at,
          propertyId: player.housing_last_property_id ?? undefined,
        };
  const stack = pushHousingStack([], entry);
  updatePlayer(player.user_id, {
    housing_stack: JSON.stringify(stack),
    housing_last_type: null,
    housing_last_city_id: null,
    housing_last_expires_at: null,
    housing_last_owned_id: null,
    housing_last_property_id: null,
  });
  return getPlayer(player.user_id) ?? player;
}

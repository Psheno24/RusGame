import { formatRub } from "./formatRub.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getDb, getPlayer, updatePlayer, type PlayerRow } from "./db.js";
import {
  formatSimNumber,
  playerHasSim,
  playerSimParts,
  rollUniqueSimLast,
  rollUniqueSimMid,
  rollUniqueSimNumberParts,
  rollUniqueSimOperator,
  SHOP_SIM_CHANGE_LAST_BASE_RUB,
  SHOP_SIM_CHANGE_MID_BASE_RUB,
  SHOP_SIM_CHANGE_OPERATOR_BASE_RUB,
  SHOP_SIM_REGISTER_BASE_RUB,
  SHOP_SIM_START_BALANCE_RUB,
  simNumberKey,
  type SimNumberParts,
} from "./simNumber.js";

export const SIM_SHOP_PRICES = {
  register: SHOP_SIM_REGISTER_BASE_RUB,
  changeOperator: SHOP_SIM_CHANGE_OPERATOR_BASE_RUB,
  changeMid: SHOP_SIM_CHANGE_MID_BASE_RUB,
  changeLast: SHOP_SIM_CHANGE_LAST_BASE_RUB,
  startBalance: SHOP_SIM_START_BALANCE_RUB,
};

function takenSimKeys(excludeUserId: number): Set<string> {
  const rows = getDb()
    .prepare(
      `SELECT sim_operator, sim_mid, sim_last FROM players
       WHERE user_id != ? AND sim_operator IS NOT NULL AND sim_mid IS NOT NULL AND sim_last IS NOT NULL`,
    )
    .all(excludeUserId) as Pick<PlayerRow, "sim_operator" | "sim_mid" | "sim_last">[];

  const taken = new Set<string>();
  for (const r of rows) {
    taken.add(simNumberKey({
      operator: r.sim_operator!,
      mid: r.sim_mid!,
      last: r.sim_last!,
    }));
  }
  return taken;
}

function applySimParts(userId: number, player: PlayerRow, parts: SimNumberParts, patch: Partial<PlayerRow>) {
  const formatted = formatSimNumber(parts);
  updatePlayer(userId, {
    sim_operator: parts.operator,
    sim_mid: parts.mid,
    sim_last: parts.last,
    phone_number: formatted,
    ...patch,
  });
}

function requirePhoneDevice(player: PlayerRow): string | null {
  if (!player.phone_device_id) return "Сначала купите телефон в разделе «Устройства»";
  return null;
}

export function registerSim(userId: number): { ok: true; number: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const needPhone = requirePhoneDevice(player);
  if (needPhone) return { ok: false, error: needPhone };
  if (playerHasSim(player)) return { ok: false, error: "Симка уже оформлена" };
  if (player.rubles < SHOP_SIM_REGISTER_BASE_RUB) {
    return { ok: false, error: `Нужно ${formatRub(SHOP_SIM_REGISTER_BASE_RUB)}` };
  }

  const parts = rollUniqueSimNumberParts(takenSimKeys(userId));
  applySimParts(userId, player, parts, {
    rubles: player.rubles - SHOP_SIM_REGISTER_BASE_RUB,
    sim_balance_rub: SHOP_SIM_START_BALANCE_RUB,
    sim_tariff_id: "incoming_only",
    sim_tariff_paid_until: null,
    sim_tariff_pending_id: null,
  });
  const number = formatSimNumber(parts);
  appendPlayerFeed(userId, "shop:sim", `Оформили симку ${number}`, Date.now());
  return { ok: true, number };
}

export type SimChangePart = "operator" | "mid" | "last";

export function changeSimPart(
  userId: number,
  part: SimChangePart,
): { ok: true; number: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const needPhone = requirePhoneDevice(player);
  if (needPhone) return { ok: false, error: needPhone };
  const cur = playerSimParts(player);
  if (!cur) return { ok: false, error: "Сначала оформите симку" };

  const costs: Record<SimChangePart, number> = {
    operator: SHOP_SIM_CHANGE_OPERATOR_BASE_RUB,
    mid: SHOP_SIM_CHANGE_MID_BASE_RUB,
    last: SHOP_SIM_CHANGE_LAST_BASE_RUB,
  };
  const cost = costs[part];
  if (player.rubles < cost) return { ok: false, error: `Нужно ${formatRub(cost)}` };

  const taken = takenSimKeys(userId);
  let next: SimNumberParts;
  if (part === "operator") {
    next = { ...cur, operator: rollUniqueSimOperator(taken, { mid: cur.mid, last: cur.last }) };
  } else if (part === "mid") {
    next = { ...cur, mid: rollUniqueSimMid(taken, { operator: cur.operator, last: cur.last }) };
  } else {
    next = { ...cur, last: rollUniqueSimLast(taken, { operator: cur.operator, mid: cur.mid }) };
  }

  applySimParts(userId, player, next, { rubles: player.rubles - cost });
  const number = formatSimNumber(next);
  const partLabel = part === "operator" ? "оператор" : part === "mid" ? "середину" : "конец";
  appendPlayerFeed(userId, "shop:sim", `Сменили ${partLabel} номера → ${number}`, Date.now());
  return { ok: true, number };
}

export function topupSim(userId: number, amount: number): { ok: true; simBalance: number } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const needPhone = requirePhoneDevice(player);
  if (needPhone) return { ok: false, error: needPhone };
  if (!playerHasSim(player)) return { ok: false, error: "Сначала оформите симку" };

  const rub = Math.floor(amount);
  if (!Number.isFinite(rub) || rub < 1) return { ok: false, error: `Введите сумму от ${formatRub(1)}` };
  if (player.rubles < rub) return { ok: false, error: `На счёте только ${formatRub(Math.floor(player.rubles))}` };

  const simBalance = Math.floor(player.sim_balance_rub ?? 0) + rub;
  updatePlayer(userId, {
    rubles: player.rubles - rub,
    sim_balance_rub: simBalance,
  });
  return { ok: true, simBalance };
}

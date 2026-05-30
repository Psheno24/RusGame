import type { PlayerRow } from "./db.js";

/** Как в DiscordNashBot: economySimNumber.ts */
export const SIM_OPERATOR_MIN = 900;
export const SIM_OPERATOR_MAX = 999;

export const SHOP_SIM_REGISTER_BASE_RUB = 100;
export const SHOP_SIM_CHANGE_OPERATOR_BASE_RUB = 5_000;
export const SHOP_SIM_CHANGE_MID_BASE_RUB = 3_000;
export const SHOP_SIM_CHANGE_LAST_BASE_RUB = 2_000;
export const SHOP_SIM_START_BALANCE_RUB = 50;

export type SimNumberParts = {
  operator: string;
  mid: string;
  last: string;
};

const MAX_UNIQUE_SIM_ATTEMPTS = 200;

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function rollRandomSimOperator(): string {
  return String(randInt(SIM_OPERATOR_MIN, SIM_OPERATOR_MAX));
}

export function rollRandomSimMid(): string {
  return String(randInt(0, 999)).padStart(3, "0");
}

export function rollRandomSimLast(): string {
  return String(randInt(0, 9999)).padStart(4, "0");
}

export function rollRandomSimNumberParts(): SimNumberParts {
  return {
    operator: rollRandomSimOperator(),
    mid: rollRandomSimMid(),
    last: rollRandomSimLast(),
  };
}

export function isValidSimNumberParts(p: SimNumberParts): boolean {
  const op = Number(p.operator);
  if (!/^\d{3}$/.test(p.operator) || op < SIM_OPERATOR_MIN || op > SIM_OPERATOR_MAX) return false;
  if (!/^\d{3}$/.test(p.mid)) return false;
  if (!/^\d{4}$/.test(p.last)) return false;
  return true;
}

export function simNumberKey(parts: SimNumberParts): string {
  return `${parts.operator}|${parts.mid}|${parts.last}`;
}

/** +7 9XX-XXX-XX-XX */
export function formatSimNumber(parts: SimNumberParts): string {
  const a = parts.last.slice(0, 2);
  const b = parts.last.slice(2, 4);
  return `+7 ${parts.operator}-${parts.mid}-${a}-${b}`;
}

export function rollUniqueSimOperator(
  takenKeys: ReadonlySet<string>,
  fixed: Pick<SimNumberParts, "mid" | "last">,
): string {
  for (let i = 0; i < MAX_UNIQUE_SIM_ATTEMPTS; i++) {
    const operator = rollRandomSimOperator();
    if (!takenKeys.has(simNumberKey({ operator, ...fixed }))) return operator;
  }
  for (let v = SIM_OPERATOR_MIN; v <= SIM_OPERATOR_MAX; v++) {
    const operator = String(v);
    if (!takenKeys.has(simNumberKey({ operator, ...fixed }))) return operator;
  }
  return rollRandomSimOperator();
}

export function rollUniqueSimMid(takenKeys: ReadonlySet<string>, fixed: Pick<SimNumberParts, "operator" | "last">): string {
  for (let i = 0; i < MAX_UNIQUE_SIM_ATTEMPTS; i++) {
    const mid = rollRandomSimMid();
    if (!takenKeys.has(simNumberKey({ ...fixed, mid }))) return mid;
  }
  for (let v = 0; v <= 999; v++) {
    const mid = String(v).padStart(3, "0");
    if (!takenKeys.has(simNumberKey({ ...fixed, mid }))) return mid;
  }
  return rollRandomSimMid();
}

export function rollUniqueSimLast(
  takenKeys: ReadonlySet<string>,
  fixed: Pick<SimNumberParts, "operator" | "mid">,
): string {
  for (let i = 0; i < MAX_UNIQUE_SIM_ATTEMPTS; i++) {
    const last = rollRandomSimLast();
    if (!takenKeys.has(simNumberKey({ ...fixed, last }))) return last;
  }
  for (let v = 0; v <= 9999; v++) {
    const last = String(v).padStart(4, "0");
    if (!takenKeys.has(simNumberKey({ ...fixed, last }))) return last;
  }
  return rollRandomSimLast();
}

export function rollUniqueSimNumberParts(takenKeys: ReadonlySet<string>): SimNumberParts {
  for (let i = 0; i < MAX_UNIQUE_SIM_ATTEMPTS; i++) {
    const parts = rollRandomSimNumberParts();
    if (!takenKeys.has(simNumberKey(parts))) return parts;
  }
  return rollRandomSimNumberParts();
}

function parseLegacyPhoneNumber(raw: string): SimNumberParts | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const d = digits.slice(-10);
  const parts = { operator: d.slice(0, 3), mid: d.slice(3, 6), last: d.slice(6, 10) };
  return isValidSimNumberParts(parts) ? parts : null;
}

export function playerSimParts(player: PlayerRow): SimNumberParts | null {
  if (player.sim_operator && player.sim_mid && player.sim_last) {
    const parts = {
      operator: player.sim_operator,
      mid: player.sim_mid,
      last: player.sim_last,
    };
    if (isValidSimNumberParts(parts)) return parts;
  }
  if (player.phone_number) return parseLegacyPhoneNumber(player.phone_number);
  return null;
}

export function playerHasSim(player: PlayerRow): boolean {
  return playerSimParts(player) !== null;
}

export function formatSimFromPlayer(player: PlayerRow): string | null {
  const p = playerSimParts(player);
  return p ? formatSimNumber(p) : null;
}

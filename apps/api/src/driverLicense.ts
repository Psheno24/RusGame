import { formatRub } from "./formatRub.js";
import { getPlayer, updatePlayer } from "./db.js";
import { getCarCategories } from "./gameData.js";
import { addDriverLicense, hasDriverLicense, parseDriverLicenses } from "./playerCars.js";

export function getDriverLicenseShop() {
  return getCarCategories().map((c) => ({
    category: c.id,
    title: c.title,
    subtitle: c.subtitle,
    priceRub: c.licensePriceRub,
  }));
}

export function buyDriverLicenseCategory(
  userId: number,
  category: string,
): { ok: true } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  const def = getCarCategories().find((c) => c.id === category);
  if (!def) return { ok: false, error: "Категория не найдена" };
  if (hasDriverLicense(player, category)) {
    return { ok: false, error: `Права категории ${category} уже есть` };
  }
  if (player.rubles < def.licensePriceRub) {
    return { ok: false, error: `Нужно ${formatRub(def.licensePriceRub)}` };
  }
  updatePlayer(userId, { rubles: player.rubles - def.licensePriceRub });
  addDriverLicense(userId, category);
  return { ok: true };
}

export function getPlayerLicenseCategories(userId: number): string[] {
  const player = getPlayer(userId);
  if (!player) return [];
  return parseDriverLicenses(player);
}

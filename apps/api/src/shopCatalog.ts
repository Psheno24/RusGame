import { getCar, getPhone } from "./gameData.js";

/** Актуальная цена модели телефона в каталоге магазина. */
export function getPhoneShopPriceRub(deviceId: string): number | null {
  return getPhone(deviceId)?.priceRub ?? null;
}

/** Актуальная цена модели авто в каталоге магазина. */
export function getCarShopPriceRub(carId: string): number | null {
  return getCar(carId)?.priceRub ?? null;
}

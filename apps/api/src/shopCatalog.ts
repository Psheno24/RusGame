import { getCarCityPriceRubById } from "./carMarket.js";
import { getCar, getPhone } from "./gameData.js";

/** Актуальная цена модели телефона в каталоге магазина. */
export function getPhoneShopPriceRub(deviceId: string): number | null {
  return getPhone(deviceId)?.priceRub ?? null;
}

/** Цена авто в магазине города (null — нет на рынке). */
export function getCarShopPriceRub(carId: string, cityId: string): number | null {
  return getCarCityPriceRubById(cityId, carId, getCar);
}

#!/usr/bin/env node
/**
 * Generates data/housingProperties.json from data/housingEstate.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const estate = JSON.parse(readFileSync(join(root, "data/housingEstate.json"), "utf-8"));

const typeByKey = Object.fromEntries(estate.propertyTypes.map((t) => [t.key, t]));

function prestigeExpensePct(prestige) {
  if (prestige >= 81) return 35;
  if (prestige >= 61) return 30;
  if (prestige >= 41) return 25;
  if (prestige >= 21) return 20;
  return 15;
}

function computeEconomy(priceRub, type) {
  const monthlyRentRub = Math.round(priceRub * 0.005);
  const expenseRatePct = prestigeExpensePct(type.prestige) + type.expenseTypePct;
  const monthlyExpensesRub = Math.round((monthlyRentRub * expenseRatePct) / 100);
  const monthlyNetIncomeRub = monthlyRentRub - monthlyExpensesRub;
  return { monthlyRentRub, monthlyExpensesRub, monthlyNetIncomeRub, expenseRatePct };
}

function descriptionFor(type, listing, cityName) {
  const place = listing.nameSuffix ? `${type.title} ${listing.nameSuffix}` : type.title;
  const district = listing.district;
  const tier =
    type.prestige >= 80
      ? "элитный объект"
      : type.prestige >= 50
        ? "престижное жильё"
        : type.prestige >= 25
          ? "комфортный вариант"
          : "бюджетный вариант";
  return `${place}, район ${district}, ${cityName}. ${tier.charAt(0).toUpperCase() + tier.slice(1)} — престиж ${type.prestige}/100.`;
}

const omskBase = estate.cities.find((c) => c.id === "omsk");
const omskPrices = omskBase.listings.map((l) => l.priceRub);

const cityNames = {
  omsk: "Омск",
  volgograd: "Волгоград",
  voronezh: "Воронеж",
  perm: "Пермь",
  krasnoyarsk: "Красноярск",
  ufa: "Уфа",
  rostov: "Ростов-на-Дону",
  samara: "Самара",
  chelyabinsk: "Челябинск",
  nn: "Нижний Новгород",
  krasnodar: "Краснодар",
  novosibirsk: "Новосибирск",
  ekb: "Екатеринбург",
  kazan: "Казань",
  spb: "Санкт-Петербург",
  moscow: "Москва",
};

const byCity = {};

for (const city of estate.cities) {
  const cityName = cityNames[city.id] ?? city.id;
  const properties = [];

  city.listings.forEach((listing, idx) => {
    const type = typeByKey[listing.typeKey];
    if (!type) throw new Error(`Unknown type ${listing.typeKey}`);
    const basePrice = listing.priceRub ?? omskPrices[idx];
    const priceRub = Math.round(basePrice * city.multiplier);
    const econ = computeEconomy(priceRub, type);
    const title = listing.nameSuffix
      ? type.title.includes(listing.nameSuffix)
        ? type.title
        : `${type.title} ${listing.nameSuffix}`
      : type.title;

    properties.push({
      id: `${city.id}_${listing.typeKey}`,
      typeKey: listing.typeKey,
      title,
      district: listing.district,
      cityId: city.id,
      priceRub,
      prestige: type.prestige,
      moodBonus: type.moodBonus,
      description: descriptionFor(type, listing, cityName),
      rooms: type.rooms,
      areaSqm: type.areaSqm,
      ...econ,
    });
  });

  byCity[city.id] = properties;
}

const out = {
  version: 2,
  propertyTypes: estate.propertyTypes,
  cityMultipliers: Object.fromEntries(estate.cities.map((c) => [c.id, c.multiplier])),
  byCity,
};

writeFileSync(join(root, "data/housingProperties.json"), JSON.stringify(out, null, 2) + "\n");
console.log(
  `Generated housingProperties.json: ${estate.cities.length} cities, ${estate.cities.length * 15} properties`,
);

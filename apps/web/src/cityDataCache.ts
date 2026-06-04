import { fetchCity } from "./api";

type CityPayload = Awaited<ReturnType<typeof fetchCity>>;

const TTL_MS = 4000;
let cache: { data: CityPayload; at: number } | null = null;

export function invalidateCityCache(): void {
  cache = null;
}

export async function fetchCityCached(force = false): Promise<CityPayload> {
  const now = Date.now();
  if (!force && cache && now - cache.at < TTL_MS) {
    return cache.data;
  }
  const data = await fetchCity();
  cache = { data, at: now };
  return data;
}

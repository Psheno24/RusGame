import { useEffect, useState } from "react";
import { fetchCar3dDisplay } from "../../api";
import {
  mergeCardDisplayConfig,
  mergePlateDisplayTuning,
  type Car3dDisplayEntry,
} from "./carDisplayConfig";

const cache = new Map<string, Car3dDisplayEntry>();

export function useCar3dDisplay(modelId: string | undefined) {
  const [entry, setEntry] = useState<Car3dDisplayEntry | null>(
    modelId ? (cache.get(modelId) ?? null) : null,
  );
  const [loading, setLoading] = useState(Boolean(modelId && !cache.has(modelId)));

  useEffect(() => {
    if (!modelId) {
      setEntry(null);
      setLoading(false);
      return;
    }

    const cached = cache.get(modelId);
    if (cached) {
      setEntry(cached);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    fetchCar3dDisplay(modelId)
      .then((data) => {
        if (!alive) return;
        cache.set(modelId, data);
        setEntry(data);
      })
      .catch(() => {
        if (!alive) return;
        setEntry(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [modelId]);

  return {
    loading,
    plateTuning: mergePlateDisplayTuning(entry?.plate),
    cardDisplay: mergeCardDisplayConfig(entry?.card),
    raw: entry,
  };
}

export function primeCar3dDisplayCache(modelId: string, entry: Car3dDisplayEntry): void {
  cache.set(modelId, entry);
}

export function clearCar3dDisplayCache(modelId?: string): void {
  if (modelId) cache.delete(modelId);
  else cache.clear();
}

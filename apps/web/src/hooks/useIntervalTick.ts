import { useEffect, useState } from "react";

/** Increments every `ms` while `active`; clears when inactive or unmounted. */
export function useIntervalTick(active: boolean, ms = 1000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return tick;
}

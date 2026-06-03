import { useCallback, useEffect, useState } from "react";
import {
  fetchTaxiStatus,
  taxiAcceptOrder,
  taxiDeclineOrder,
  taxiGoOffline,
  taxiGoOnline,
  taxiClearCar,
  taxiSelectCar,
  type TaxiStatus,
  type User,
} from "../api";

export function useTaxiLine(
  setUser: (u: User) => void,
  onToast: (msg: string, isErr?: boolean) => void,
) {
  const [status, setStatus] = useState<TaxiStatus | null>(null);
  const [pickCar, setPickCar] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await fetchTaxiStatus();
    if (data.completedMessage) {
      onToast(data.completedMessage);
      if (data.user) setUser(data.user);
    }
    setStatus(data.status);
    if (data.status.selectedCarKey) setPickCar(data.status.selectedCarKey);
    else setPickCar("");
  }, [onToast, setUser]);

  useEffect(() => {
    refresh().catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
    const ms = status?.activeTrip ? 3000 : 15000;
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, ms);
    return () => clearInterval(id);
  }, [refresh, onToast, status?.activeTrip != null]);

  const run = useCallback(
    async (fn: () => Promise<{ message: string; user: User }>) => {
      setBusy(true);
      try {
        const r = await fn();
        setUser(r.user);
        onToast(r.message);
        await refresh();
      } catch (e) {
        onToast(e instanceof Error ? e.message : "Ошибка", true);
      } finally {
        setBusy(false);
      }
    },
    [onToast, refresh, setUser],
  );

  const carSelected = Boolean(status?.selectedCarKey ?? status?.carSelected);
  const onLine = status?.onLine ?? false;
  const inTrip = status?.activeTrip != null;

  return {
    status,
    busy,
    pickCar,
    setPickCar,
    refresh,
    run,
    carSelected,
    onLine,
    inTrip,
    goOnline: () => run(taxiGoOnline),
    goOffline: () => run(taxiGoOffline),
    clearCar: () => run(taxiClearCar),
    selectCar: (source: "owned" | "rental", refId: number) =>
      run(() => taxiSelectCar(source, refId)),
    acceptOrder: (orderId: string) =>
      run(async () => {
        const r = await taxiAcceptOrder(orderId);
        return { message: r.message, user: r.user };
      }),
    declineOrder: (orderId: string) =>
      run(async () => {
        const r = await taxiDeclineOrder(orderId);
        return { message: r.message, user: r.user };
      }),
  };
}

export type TaxiLineHandle = ReturnType<typeof useTaxiLine>;

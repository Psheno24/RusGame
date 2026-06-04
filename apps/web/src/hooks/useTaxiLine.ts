import { useCallback, useEffect, useRef, useState } from "react";
import { useToastRef } from "./useToastRef";
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
  const [busy, setBusy] = useState(false);

  const onToastRef = useToastRef(onToast);
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  const refresh = useCallback(async () => {
    const data = await fetchTaxiStatus();
    if (data.completedMessage) {
      onToastRef.current(data.completedMessage);
      if (data.user) setUserRef.current(data.user);
    }
    setStatus(data.status);
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const inTrip = Boolean(status?.activeTrip);

  useEffect(() => {
    void refreshRef.current().catch((e) =>
      onToastRef.current(e instanceof Error ? e.message : "Ошибка", true),
    );
    const ms = inTrip ? 3000 : 15000;
    const id = setInterval(() => {
      void refreshRef.current().catch(() => {});
    }, ms);
    return () => clearInterval(id);
  }, [inTrip]);

  const run = useCallback(
    async (fn: () => Promise<{ message: string; user: User }>) => {
      setBusy(true);
      try {
        const r = await fn();
        setUserRef.current(r.user);
        onToastRef.current(r.message);
        await refreshRef.current();
      } catch (e) {
        onToastRef.current(e instanceof Error ? e.message : "Ошибка", true);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const carSelected = Boolean(status?.selectedCarKey ?? status?.carSelected);
  const onLine = status?.onLine ?? false;

  return {
    status,
    busy,
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

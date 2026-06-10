import { useCallback, useEffect, useRef, useState } from "react";
import { useToastRef } from "./useToastRef";
import { deliveryTakeOrder, fetchDeliveryStatus, type DeliveryStatus, type User } from "../api";

export function useDeliveryLine(
  setUser: (u: User) => void,
  onToast: (msg: string, isErr?: boolean) => void,
) {
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const onToastRef = useToastRef(onToast);
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  const refresh = useCallback(async () => {
    const data = await fetchDeliveryStatus();
    if (data.status.completedMessage) {
      onToastRef.current(data.status.completedMessage);
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
    const ms = inTrip ? 2000 : 10000;
    const id = setInterval(() => {
      void refreshRef.current().catch(() => {});
    }, ms);
    return () => clearInterval(id);
  }, [inTrip]);

  const takeOrder = useCallback(async () => {
    setBusy(true);
    try {
      const data = await deliveryTakeOrder();
      onToastRef.current(data.message);
      if (data.user) setUserRef.current(data.user);
      await refreshRef.current();
    } catch (e) {
      onToastRef.current(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    status,
    busy,
    inTrip,
    takeOrder,
    refresh,
    canTakeOrder: status?.canTakeOrder ?? false,
    takeOrderBlockedReason: status?.takeOrderBlockedReason ?? null,
    transport: status?.transport ?? "walk",
    sessionIncomeRub: status?.sessionIncomeRub ?? 0,
    ordersCompleted: status?.ordersCompleted ?? 0,
    activeTrip: status?.activeTrip ?? null,
    incomeMultiplier: status?.incomeMultiplier ?? 1,
  };
}

import { formatRub } from "../formatRub.js";
import { useCallback, useEffect, useState } from "react";
import { useToastRef } from "../hooks/useToastRef";
import {
  fetchGasStation,
  refuelAtGasStation,
  type FuelType,
  type GasStationCarView,
  type GasStationView,
  type User,
} from "../api";
import type { NavBackHandler } from "../navBack";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitPlace: () => void;
};

const FUEL_LABELS: Record<FuelType, string> = {
  ai92: "АИ-92",
  ai95: "АИ-95",
  premium: "Премиум",
};

export function GasStationPlace({ user, setUser, onToast, registerBack, onExitPlace }: Props) {
  const [station, setStation] = useState<GasStationView | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const onToastRef = useToastRef(onToast);

  const reload = useCallback(async () => {
    const data = await fetchGasStation();
    setStation(data);
    return data;
  }, []);

  useEffect(() => {
    reload().catch((e) =>
      onToastRef.current(e instanceof Error ? e.message : "Ошибка", true),
    );
  }, [reload]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      onExitPlace();
      return true;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [registerBack, onExitPlace]);

  const refuel = async (car: GasStationCarView, fuelType: FuelType) => {
    if (busyId != null) return;
    if (car.litersToFull <= 0) {
      onToastRef.current("Бак уже полный", true);
      return;
    }
    const cost = car.fillCostRub[fuelType];
    if (user.player.rubles < cost) {
      onToastRef.current(`Нужно ${formatRub(cost)}`, true);
      return;
    }
    setBusyId(car.playerCarId);
    try {
      const r = await refuelAtGasStation({
        playerCarId: car.playerCarId,
        fuelType,
      });
      setUser(r.user);
      onToastRef.current(
        `${r.carName}: +${r.liters} л ${FUEL_LABELS[fuelType]} (−${formatRub(r.costRub)})`,
      );
      await reload();
    } catch (e) {
      onToastRef.current(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusyId(null);
    }
  };

  if (!station) {
    return <p className="shop-stub">Загрузка…</p>;
  }

  return (
    <div className="place-detail gas-station">
      <p className="place-detail-lead">
        АИ-92 {formatRub(station.fuelPrices.ai92)}/л · АИ-95{" "}
        {formatRub(station.fuelPrices.ai95)}/л · Премиум {formatRub(station.fuelPrices.premium)}/л
      </p>
      {station.cars.length === 0 ? (
        <p className="shop-stub">Нет автомобилей для заправки</p>
      ) : (
        <ul className="gas-station-cars">
          {station.cars.map((car) => (
            <li key={car.playerCarId} className="gas-station-car card-inset">
              <div className="gas-station-car-head">
                <span className="car-accent" style={{ color: car.accent }}>
                  ●
                </span>
                <strong>
                  {car.brand} {car.model}
                </strong>
              </div>
              <p>
                Бак: {car.fuelLevelL} / {car.tankL} л ({car.fuelPct}%)
                {car.litersToFull > 0 ? ` · до полного +${car.litersToFull} л` : ""}
              </p>
              {car.litersToFull > 0 ? (
                <div className="gas-station-fuels">
                  {(["ai92", "ai95", "premium"] as FuelType[]).map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      className={
                        ft === car.recommendedFuel ? "btn btn-primary" : "btn btn-secondary"
                      }
                      disabled={busyId === car.playerCarId}
                      onClick={() => refuel(car, ft)}
                    >
                      {busyId === car.playerCarId
                        ? "…"
                        : `${FUEL_LABELS[ft]} · ${formatRub(car.fillCostRub[ft])}`}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="license-ok">Бак полный</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

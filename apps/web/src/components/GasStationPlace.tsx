import { formatRub } from "../formatRub.js";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { PlaceNavState } from "../placeNav";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: PlaceNavState) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitPlace: () => void;
};

type Nav = "list" | "detail";

const FUEL_LABELS: Record<FuelType, string> = {
  ai92: "АИ-92",
  ai95: "АИ-95",
  premium: "Премиум",
};

function roundFuelLiters(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatFuelLiters(n: number): string {
  const rounded = roundFuelLiters(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Есть дробная часть до полного бака (например 3.6 л). */
function hasFuelFraction(litersToFull: number): boolean {
  return Math.round(roundFuelLiters(litersToFull) * 10) % 10 !== 0;
}

/** Позиции ползунка: 1…floor(л), последняя — ровно до полного бака. */
function refuelSliderMax(litersToFull: number): number {
  const full = roundFuelLiters(litersToFull);
  if (full <= 0) return 0;
  const floor = Math.floor(full);
  return hasFuelFraction(full) ? floor + 1 : Math.max(1, floor);
}

function sliderValueToLiters(sliderValue: number, litersToFull: number): number {
  const full = roundFuelLiters(litersToFull);
  const max = refuelSliderMax(full);
  if (sliderValue >= max) return full;
  return sliderValue;
}

function carTitle(car: GasStationCarView): string {
  if (car.isRental) return `${car.brand}`;
  return `${car.brand} ${car.model}`;
}

function carListKey(car: GasStationCarView): string {
  return car.isRental ? "rental" : String(car.playerCarId);
}

export function GasStationPlace({ user, setUser, onToast, onNavChange, registerBack, onExitPlace }: Props) {
  const [station, setStation] = useState<GasStationView | null>(null);
  const [nav, setNav] = useState<Nav>("list");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [liters, setLiters] = useState(1);
  const [busy, setBusy] = useState(false);
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

  const selectedCar = useMemo(
    () => station?.cars.find((c) => carListKey(c) === selectedKey) ?? null,
    [station, selectedKey],
  );

  const sliderMax = selectedCar ? refuelSliderMax(selectedCar.litersToFull) : 0;
  const canRefuel = sliderMax >= 1;
  const actualLiters = selectedCar ? sliderValueToLiters(liters, selectedCar.litersToFull) : 0;

  useEffect(() => {
    if (!selectedCar) return;
    setLiters((prev) => Math.min(sliderMax, Math.max(1, prev)));
  }, [selectedCar, sliderMax]);

  useEffect(() => {
    const title = nav === "detail" ? "Заправка" : "АЗС";
    const backLabel = nav === "detail" ? "АЗС" : "Другие места";
    onNavChange({ inSub: nav === "detail", title, backLabel });
  }, [nav, onNavChange]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (nav === "detail") {
        setNav("list");
        setSelectedKey(null);
        return true;
      }
      onExitPlace();
      return true;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [nav, registerBack, onExitPlace]);

  const openCar = (car: GasStationCarView) => {
    setSelectedKey(carListKey(car));
    setLiters(refuelSliderMax(car.litersToFull));
    setNav("detail");
  };

  const refuel = async () => {
    if (!selectedCar || busy || !canRefuel) return;
    const fuelType = selectedCar.recommendedFuel;
    const pricePerL = station?.fuelPrices[fuelType] ?? 0;
    const cost = Math.round(actualLiters * pricePerL);
    if (user.player.rubles < cost) {
      onToastRef.current(`Нужно ${formatRub(cost)}`, true);
      return;
    }
    setBusy(true);
    try {
      const r = await refuelAtGasStation(
        selectedCar.isRental
          ? { rental: true, fuelType, liters: actualLiters }
          : { playerCarId: selectedCar.playerCarId!, fuelType, liters: actualLiters },
      );
      setUser(r.user);
      onToastRef.current(
        `${r.carName}: +${r.liters} л ${FUEL_LABELS[fuelType]} (−${formatRub(r.costRub)})`,
      );
      await reload();
    } catch (e) {
      onToastRef.current(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  if (!station) {
    return <p className="shop-stub">Загрузка…</p>;
  }

  if (nav === "detail" && selectedCar) {
    const fuelType = selectedCar.recommendedFuel;
    const pricePerL = station.fuelPrices[fuelType];
    const previewLevel = roundFuelLiters(selectedCar.fuelLevelL + actualLiters);
    const totalCost = Math.round(actualLiters * pricePerL);
    const afford = user.player.rubles >= totalCost;

    return (
      <div className="gas-station-detail">
        <p className="gas-station-car-title">
          <span className="car-accent" style={{ color: selectedCar.accent }} aria-hidden>
            ●
          </span>{" "}
          <strong>{carTitle(selectedCar)}</strong> (
          <span className="gas-station-fuel-preview">{formatFuelLiters(previewLevel)}</span> /{" "}
          {formatFuelLiters(selectedCar.tankL)} л)
        </p>
        <p className="gas-station-fuel-line">
          {FUEL_LABELS[fuelType]} · {formatRub(pricePerL)}/л · {formatRub(totalCost)}
        </p>
        {canRefuel ? (
          <>
            <input
              type="range"
              className="home-sleep-slider gas-station-slider"
              min={1}
              max={sliderMax}
              step={1}
              value={liters}
              disabled={busy}
              onChange={(e) => setLiters(Number(e.target.value))}
              aria-label="Литры для заправки"
            />
            <p className="gas-station-liters-hint">
              Заправить: <strong>{formatFuelLiters(actualLiters)}</strong> л
              {liters >= sliderMax && hasFuelFraction(selectedCar.litersToFull) ? (
                <span className="phone-list-meta"> · до полного бака</span>
              ) : null}
            </p>
          </>
        ) : (
          <p className="license-ok">Бак полный</p>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy || !canRefuel || !afford}
          onClick={() => void refuel()}
        >
          {busy ? "…" : "Заправить"}
        </button>
      </div>
    );
  }

  return (
    <div className="gas-station-list">
      {station.cars.length === 0 ? (
        <p className="shop-stub">Нет автомобилей для заправки</p>
      ) : (
        <ul className="phone-list gas-station-cars">
          {station.cars.map((car) => (
            <li key={carListKey(car)}>
              <button type="button" className="phone-list-item" onClick={() => openCar(car)}>
                <span className="car-list-thumb" style={{ background: car.accent }} aria-hidden />
                <span className="phone-list-info">
                  <span className="phone-list-name">
                    {carTitle(car)}
                    {car.isRental ? <span className="phone-list-meta"> · аренда</span> : null}
                  </span>
                  <span className="phone-list-price">
                    {formatFuelLiters(car.fuelLevelL)} / {formatFuelLiters(car.tankL)} л ({car.fuelPct}
                    %)
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

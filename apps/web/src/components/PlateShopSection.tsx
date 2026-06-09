import { useCallback, useEffect, useState } from "react";
import {
  fetchPlateGarage,
  fetchPlateShopCar,
  plateRegister,
  plateRollDigits,
  plateRollLetters,
  plateRollRegion,
  type PlateGarageCar,
  type PlateShopCarInfo,
  type User,
} from "../api";
import { useToastRef } from "../hooks/useToastRef";
import type { NavBackHandler } from "../navBack";
import {
  PLATES_DETAIL_LEAD,
  PLATES_LIST_LEAD,
  PLATES_MENU_TITLE,
  PLATES_WHERE_HINT,
} from "../plateCopy";
import type { PlaceNavState } from "../placeNav";
import { PlateShopPanel } from "./PlateShopPanel";
import { VehiclePlate } from "./VehiclePlate";
import { CarModelPreview, DEFAULT_CAR_BODY_COLOR, hasCar3dModel } from "./cars";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange?: (state: PlaceNavState) => void;
  registerBack: (handler: NavBackHandler | null) => void;
};

function ShopCarThumb({ modelId, accent }: { modelId: string; accent: string }) {
  if (hasCar3dModel(modelId)) {
    return (
      <CarModelPreview
        modelId={modelId}
        bodyColor={DEFAULT_CAR_BODY_COLOR}
        variant="thumb"
        transparentBackground
      />
    );
  }
  return <span className="car-list-thumb" style={{ background: accent }} aria-hidden />;
}

function ShopCarBanner({ modelId, accent }: { modelId: string; accent: string }) {
  if (hasCar3dModel(modelId)) {
    return (
      <CarModelPreview
        modelId={modelId}
        bodyColor={DEFAULT_CAR_BODY_COLOR}
        variant="banner"
        large
        transparentBackground
      />
    );
  }
  return (
    <div className="car-visual car-visual--lg" style={{ background: accent }} aria-hidden />
  );
}

export function PlateShopSection({ setUser, onToast, onNavChange, registerBack }: Props) {
  const onToastRef = useToastRef(onToast);
  const [view, setView] = useState<"list" | "detail">("list");
  const [playerCarId, setPlayerCarId] = useState<number | null>(null);
  const [plateGarage, setPlateGarage] = useState<PlateGarageCar[]>([]);
  const [plateInfo, setPlateInfo] = useState<PlateShopCarInfo | null>(null);
  const [plateSpin, setPlateSpin] = useState(false);
  const [busy, setBusy] = useState(false);

  const plateCar = playerCarId ? plateGarage.find((c) => c.playerCarId === playerCarId) : null;

  useEffect(() => {
    if (!onNavChange) return;
    if (view === "detail" && plateInfo) {
      onNavChange({
        inSub: true,
        title: `${plateInfo.brand} ${plateInfo.model}`,
        backLabel: PLATES_MENU_TITLE,
      });
    } else {
      onNavChange({
        inSub: false,
        title: PLATES_MENU_TITLE,
        backLabel: "Полиция",
      });
    }
  }, [view, plateInfo, onNavChange]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (view === "detail") {
        setView("list");
        setPlayerCarId(null);
        setPlateInfo(null);
        return true;
      }
      return false;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [view, registerBack]);

  const reloadGarage = useCallback(async () => {
    const r = await fetchPlateGarage();
    setPlateGarage(r.cars);
  }, []);

  const reloadDetail = useCallback(async () => {
    if (!playerCarId) return;
    setPlateInfo(await fetchPlateShopCar(playerCarId));
    await reloadGarage();
  }, [playerCarId, reloadGarage]);

  useEffect(() => {
    if (view === "list") {
      reloadGarage().catch((e) =>
        onToastRef.current(e instanceof Error ? e.message : "Ошибка", true),
      );
    }
  }, [view, reloadGarage]);

  useEffect(() => {
    if (view !== "detail" || !playerCarId) {
      setPlateInfo(null);
      return;
    }
    fetchPlateShopCar(playerCarId)
      .then(setPlateInfo)
      .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
  }, [view, playerCarId]);

  const runPlate = async (fn: (id: number) => Promise<{ plateText: string; user: User }>) => {
    if (!playerCarId) return;
    setPlateSpin(true);
    try {
      const r = await fn(playerCarId);
      setUser(r.user);
      onToast(`Номерной знак: ${r.plateText}`);
      await reloadDetail();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setTimeout(() => setPlateSpin(false), 400);
    }
  };

  const openCar = (id: number) => {
    setPlayerCarId(id);
    setPlateInfo(null);
    setView("detail");
  };

  if (view === "detail") {
    if (!plateInfo) return <p className="shop-stub">Загрузка…</p>;
    return (
      <div className="phone-detail">
        <ShopCarBanner modelId={plateCar?.modelId ?? ""} accent={plateInfo.accent} />
        <h3 className="phone-detail-title">
          {plateInfo.brand} {plateInfo.model}
        </h3>
        <p className="shop-owned">{PLATES_DETAIL_LEAD}</p>
        <PlateShopPanel
          info={plateInfo}
          spinning={plateSpin}
          busy={busy}
          onRegister={() => void runPlate(plateRegister)}
          onDigits={() => void runPlate(plateRollDigits)}
          onLetters={() => void runPlate(plateRollLetters)}
          onRegion={() => void runPlate(plateRollRegion)}
        />
      </div>
    );
  }

  return (
    <div className="phone-catalog">
      <p className="place-detail-lead">{PLATES_LIST_LEAD}</p>
      {plateGarage.length === 0 ? (
        <p className="shop-owned">
          Сначала купите автомобиль в магазине города. {PLATES_WHERE_HINT} — после покупки.
        </p>
      ) : (
        <ul className="phone-list">
          {plateGarage.map((c) => (
            <li key={c.playerCarId}>
              <button type="button" className="phone-list-item" onClick={() => openCar(c.playerCarId)}>
                <ShopCarThumb modelId={c.modelId} accent={c.accent} />
                <span className="phone-list-info">
                  <span className="phone-list-name">
                    {c.brand} {c.model}
                  </span>
                  <span className="phone-list-price">
                    {c.plateText ? "знак оформлен" : "без знака"}
                  </span>
                </span>
                {c.plate ? (
                  <VehiclePlate parts={c.plate} size="sm" className="plate-list-plate" />
                ) : (
                  <span className="plate-list-empty">—</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

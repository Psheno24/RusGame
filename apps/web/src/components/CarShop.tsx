import { useCallback, useEffect, useState } from "react";
import { useToastRef } from "../hooks/useToastRef";
import {
  buyCar,
  buyUsedCar,
  diagnoseUsedCar,
  fetchCarCategories,
  fetchCarQuote,
  fetchCarSellQuote,
  fetchPlateGarage,
  fetchPlateShopCar,
  fetchShopCars,
  fetchUsedCarDetail,
  fetchUsedCarMarket,
  sellCar,
  fetchVehicleRentals,
  plateRegister,
  plateRollDigits,
  plateRollLetters,
  plateRollRegion,
  rentVehicle,
  tradeInCar,
  type CarCategory,
  type CarModel,
  type CarPurchaseQuote,
  type OwnedCar,
  type PlateGarageCar,
  type PlateShopCarInfo,
  type UsedCarDiagnosisRanges,
  type UsedCarListing,
  type UsedCarMarket,
  type User,
  type VehicleRental,
} from "../api";
import type { NavBackHandler } from "../navBack";
import { ConfirmDialog } from "./ConfirmDialog";
import { CityGridButton } from "./ui/CityGridButton";
import { PlateShopPanel } from "./PlateShopPanel";
import { VehiclePlate } from "./VehiclePlate";

type CarNav =
  | "hub"
  | "buyChoice"
  | "buyCategories"
  | "buyList"
  | "buyDetail"
  | "tradeIn"
  | "usedList"
  | "usedDetail"
  | "rent"
  | "plate"
  | "plateDetail"
  | "tuning";

type Pending =
  | { kind: "buy"; carId: string; name: string; priceRub: number }
  | { kind: "buyUsed"; listingId: string; name: string; priceRub: number }
  | { kind: "tradeIn"; carId: string; name: string; quote: CarPurchaseQuote; tradeInCarIds: number[] }
  | {
      kind: "sell";
      playerCarId: number;
      name: string;
      amountRub: number;
      catalogPriceRub: number;
      plateText: string | null;
    }
  | { kind: "rent"; rentalId: string; label: string; priceRub: number };

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
  registerBack: (handler: NavBackHandler | null) => void;
};

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function formatRefreshAt(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diagnosisLine(label: string, range: { min: number; max: number }) {
  return (
    <div key={label}>
      <dt>{label}</dt>
      <dd>
        {range.min}–{range.max}%
      </dd>
    </div>
  );
}

function UsedDiagnosisSpecs({ diagnosis }: { diagnosis: UsedCarDiagnosisRanges }) {
  return (
    <dl className="phone-specs used-diagnosis">
      {diagnosisLine("Двигатель", diagnosis.engine)}
      {diagnosisLine("Шины", diagnosis.tires)}
      {diagnosisLine("Сход-развал", diagnosis.alignment)}
      {diagnosisLine("Электроника", diagnosis.electronics)}
      {diagnosisLine("Кузов", diagnosis.body)}
      {diagnosisLine("Салон", diagnosis.interior)}
    </dl>
  );
}

function tradeInPriceHint(c: CarModel): string | null {
  if (c.payFromRub == null || c.payToRub == null) return null;
  if (c.payFromRub === c.payToRub) {
    return `цена с учётом трейд-ин: ${rub(c.payFromRub)}`;
  }
  return `цена с учётом трейд-ин: от ${rub(c.payFromRub)} до ${rub(c.payToRub)}`;
}

function CarVisual({ accent, large }: { accent: string; large?: boolean }) {
  return (
    <div
      className={`car-visual${large ? " car-visual--lg" : ""}`}
      style={{ background: accent }}
      aria-hidden
    />
  );
}

export function CarShop({ user, setUser, onToast, onNavChange, registerBack }: Props) {
  const [nav, setNav] = useState<CarNav>("hub");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [carId, setCarId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CarCategory[]>([]);
  const [cars, setCars] = useState<CarModel[]>([]);
  const [ownedCars, setOwnedCars] = useState<OwnedCar[]>([]);
  const [rentals, setRentals] = useState<VehicleRental[]>([]);
  const [platePlayerCarId, setPlatePlayerCarId] = useState<number | null>(null);
  const [plateGarage, setPlateGarage] = useState<PlateGarageCar[]>([]);
  const [plateInfo, setPlateInfo] = useState<PlateShopCarInfo | null>(null);
  const [plateSpin, setPlateSpin] = useState(false);
  const [tradeInIds, setTradeInIds] = useState<number[]>([]);
  const [tradeQuote, setTradeQuote] = useState<CarPurchaseQuote | null>(null);
  const [usedMarket, setUsedMarket] = useState<UsedCarMarket | null>(null);
  const [usedListingId, setUsedListingId] = useState<string | null>(null);
  const [usedDetail, setUsedDetail] = useState<UsedCarListing | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const p = user.player;
  const licenses = new Set(p.driverLicenseCategories ?? []);
  const selected = carId ? cars.find((c) => c.id === carId) : null;
  const category = categoryId ? categories.find((c) => c.id === categoryId) : null;
  const plateCar = platePlayerCarId ? plateGarage.find((c) => c.playerCarId === platePlayerCarId) : null;
  const ownedInstance = selected ? ownedCars.find((oc) => oc.modelId === selected.id) : null;
  const usedSelected =
    usedDetail ?? (usedListingId ? usedMarket?.listings.find((l) => l.id === usedListingId) : null);

  const go = (next: CarNav, opts?: { category?: string | null; car?: string | null }) => {
    setNav(next);
    if (opts?.category !== undefined) setCategoryId(opts.category);
    if (opts?.car !== undefined) setCarId(opts.car);
    if (next === "plate") {
      setPlatePlayerCarId(null);
      setPlateInfo(null);
    }
    if (next !== "tradeIn") {
      setTradeInIds([]);
      setTradeQuote(null);
    }
  };

  const reloadCategory = useCallback(async () => {
    if (!categoryId) return;
    const r = await fetchShopCars(categoryId);
    setCars(r.cars);
    setOwnedCars(r.ownedCars);
  }, [categoryId]);

  useEffect(() => {
    let title = "Авто";
    let backLabel = "Магазин";
    if (nav === "buyChoice") {
      title = "Купить авто";
      backLabel = "Авто";
    } else if (nav === "buyCategories") {
      title = "Новые";
      backLabel = "Купить";
    } else if (nav === "usedList") {
      title = "С пробегом";
      backLabel = "Купить";
    } else if (nav === "usedDetail" && usedSelected) {
      title = `${usedSelected.brand} ${usedSelected.model}`;
      backLabel = "С пробегом";
    } else if (nav === "buyList" && category) {
      title = category.title;
      backLabel = "Новые";
    } else if (nav === "buyDetail" && selected) {
      title = `${selected.brand} ${selected.model}`;
      backLabel = category?.title ?? "Новые";
    } else if (nav === "tradeIn" && selected) {
      title = "Трейд-ин";
      backLabel = `${selected.brand} ${selected.model}`;
    } else if (nav === "rent") {
      title = "Аренда";
      backLabel = "Авто";
    } else if (nav === "plate") {
      title = "Гос.номер";
      backLabel = "Авто";
    } else if (nav === "plateDetail" && plateCar) {
      title = `${plateCar.brand} ${plateCar.model}`;
      backLabel = "Гос.номер";
    } else if (nav === "tuning") {
      title = "Тюнинг";
      backLabel = "Авто";
    }
    onNavChange({ inSub: nav !== "hub", title, backLabel });
  }, [nav, onNavChange, selected, category, plateCar, usedSelected]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (nav === "tradeIn") {
        setNav("buyDetail");
        return true;
      }
      if (nav === "plateDetail") {
        setNav("plate");
        setPlatePlayerCarId(null);
        setPlateInfo(null);
        return true;
      }
      if (nav === "buyDetail") {
        setNav("buyList");
        return true;
      }
      if (nav === "buyList") {
        setNav("buyCategories");
        return true;
      }
      if (nav === "buyCategories" || nav === "usedList") {
        setNav("buyChoice");
        return true;
      }
      if (nav === "usedDetail") {
        setNav("usedList");
        setUsedListingId(null);
        setUsedDetail(null);
        return true;
      }
      if (nav === "buyChoice") {
        setNav("hub");
        return true;
      }
      if (nav !== "hub") {
        setNav("hub");
        return true;
      }
      return false;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [nav, registerBack]);

  const onToastRef = useToastRef(onToast);

  useEffect(() => {
    if (nav !== "usedDetail" || !usedListingId) {
      setUsedDetail(null);
      return;
    }
    let cancelled = false;
    fetchUsedCarDetail(usedListingId)
      .then((detail) => {
        if (!cancelled) setUsedDetail(detail);
      })
      .catch((e) =>
        onToastRef.current(e instanceof Error ? e.message : "Ошибка", true),
      );
    return () => {
      cancelled = true;
    };
  }, [nav, usedListingId]);

  useEffect(() => {
    if (nav === "buyChoice" || nav === "buyCategories") {
      fetchCarCategories()
        .then((r) => setCategories(r.categories))
        .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
    }
    if (nav === "usedList") {
      fetchUsedCarMarket()
        .then(setUsedMarket)
        .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
    }
    if (nav === "buyList" || nav === "buyDetail" || nav === "tradeIn") {
      reloadCategory().catch((e) =>
        onToastRef.current(e instanceof Error ? e.message : "Ошибка", true),
      );
    }
    if (nav === "rent") {
      fetchVehicleRentals()
        .then((r) => setRentals(r.rentals))
        .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
    }
    if (nav === "plate") {
      fetchPlateGarage()
        .then((r) => setPlateGarage(r.cars))
        .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
    }
    if (nav === "plateDetail" && platePlayerCarId) {
      fetchPlateShopCar(platePlayerCarId)
        .then(setPlateInfo)
        .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
    }
  }, [nav, reloadCategory, platePlayerCarId]);

  useEffect(() => {
    if (nav !== "tradeIn" || !carId) return;
    fetchCarQuote(carId, tradeInIds)
      .then(setTradeQuote)
      .catch(() => setTradeQuote(null));
  }, [nav, carId, tradeInIds]);

  const reloadPlateGarage = useCallback(async () => {
    const r = await fetchPlateGarage();
    setPlateGarage(r.cars);
  }, []);

  const reloadPlateDetail = useCallback(async () => {
    if (!platePlayerCarId) return;
    setPlateInfo(await fetchPlateShopCar(platePlayerCarId));
    await reloadPlateGarage();
  }, [platePlayerCarId, reloadPlateGarage]);

  const runPlate = async (fn: (id: number) => Promise<{ plateText: string; user: User }>) => {
    if (!platePlayerCarId) return;
    setPlateSpin(true);
    try {
      const r = await fn(platePlayerCarId);
      setUser(r.user);
      onToast(`Номер: ${r.plateText}`);
      await reloadPlateDetail();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setTimeout(() => setPlateSpin(false), 400);
    }
  };

  const openPlateCar = (playerCarId: number) => {
    setPlatePlayerCarId(playerCarId);
    setPlateInfo(null);
    setNav("plateDetail");
  };

  const onConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "buy") {
        const r = await buyCar(pending.carId);
        setUser(r.user);
        onToast(`Куплено: ${r.carName}`);
        go("buyList");
      } else if (pending.kind === "buyUsed") {
        const r = await buyUsedCar(pending.listingId);
        setUser(r.user);
        onToast(`Куплено б/у: ${r.carName}. Реальное состояние узлов открыто в гараже.`);
        setUsedMarket(null);
        setUsedDetail(null);
        setUsedListingId(null);
        go("usedList");
      } else if (pending.kind === "tradeIn") {
        const r = await tradeInCar(pending.carId, pending.tradeInCarIds);
        setUser(r.user);
        const extra =
          r.excessRub > 0 ? ` На баланс зачислено ${rub(r.excessRub)}.` : "";
        onToast(`Куплено: ${r.carName}.${extra}`);
        go("buyList", { category: categoryId, car: null });
      } else if (pending.kind === "sell") {
        const r = await sellCar(pending.playerCarId);
        setUser(r.user);
        onToast(`Продано (+${rub(r.amountRub)})`);
        go("buyList", { category: categoryId, car: null });
        await reloadCategory();
      } else {
        const r = await rentVehicle(pending.rentalId);
        setUser(r.user);
        onToast(r.message ?? `Арендовано: ${r.label}`);
      }
      setPending(null);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const pendingCopy = (() => {
    if (!pending) return null;
    if (pending.kind === "rent") {
      return {
        title: "Арендовать?",
        text: `${pending.label} за ${rub(pending.priceRub)}?`,
        confirmLabel: "Арендовать",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "buy") {
      return {
        title: "Купить автомобиль?",
        text: `Купить ${pending.name} за ${rub(pending.priceRub)}? Ваши текущие машины останутся в гараже.`,
        confirmLabel: "Купить",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "buyUsed") {
      return {
        title: "Купить б/у?",
        text: `${pending.name} за ${rub(pending.priceRub)}. После покупки откроются реальные показатели двигателя, КПП и электроники — сделка может оказаться выгодной или рискованной.`,
        confirmLabel: "Купить",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "sell") {
      const plateNote = pending.plateText
        ? ` Госномер ${pending.plateText} будет снят и снова станет доступен для выбивания другими игроками.`
        : "";
      return {
        title: "Продать автомобиль?",
        text: `Продать ${pending.name}? Вы получите ${rub(pending.amountRub)} (80% от ${rub(pending.catalogPriceRub)} в магазине).${plateNote}`,
        confirmLabel: "Продать",
        confirmClassName: "btn-danger",
      };
    }
    const q = pending.quote;
    const lines = q.tradeInCars.map((c) => `${c.modelName}: ${rub(c.amountRub)}`).join("; ");
    const excess =
      q.excessRub > 0 ? ` На баланс вернётся ${rub(q.excessRub)}.` : "";
    const tradedPlates = pending.tradeInCarIds
      .map((id) => ownedCars.find((oc) => oc.id === id))
      .filter((oc): oc is OwnedCar => Boolean(oc?.plateText))
      .map((oc) => `${oc.brand} ${oc.model}: ${oc.plateText}`)
      .join("; ");
    const plateNote = tradedPlates
      ? ` Снятые номера (${tradedPlates}) снова доступны для выбивания.`
      : "";
    return {
      title: "Купить с трейд-ином?",
      text: `${pending.name}: зачёт ${rub(q.tradeInRub)} (${lines}). К оплате ${rub(q.netPriceRub)}.${excess}${plateNote}`,
      confirmLabel: "Купить",
      confirmClassName: "btn-primary",
    };
  })();

  const needsLicenseBanner =
    categoryId && !licenses.has(categoryId) && cars.length > 0;

  return (
    <>
      {pendingCopy && (
        <ConfirmDialog
          title={pendingCopy.title}
          text={pendingCopy.text}
          confirmLabel={pendingCopy.confirmLabel}
          confirmClassName={pendingCopy.confirmClassName}
          onCancel={() => setPending(null)}
          onConfirm={() => void onConfirm()}
        />
      )}

      {nav === "hub" && (
        <div className="city-grid shop-categories phone-hub">
          <CityGridButton title="Купить авто" onClick={() => go("buyChoice")} />
          <CityGridButton title="Аренда" onClick={() => go("rent")} />
          <CityGridButton title="Гос.номер" onClick={() => go("plate")} />
          <CityGridButton title="Скоро" hint="Тюнинг" disabled />
        </div>
      )}

      {nav === "buyChoice" && (
        <div className="city-grid shop-categories phone-hub">
          <CityGridButton title="Новые" onClick={() => go("buyCategories")} />
          <CityGridButton title="С пробегом" onClick={() => go("usedList")} />
        </div>
      )}

      {nav === "buyCategories" && (
        <div className="city-grid shop-categories phone-hub">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="city-grid-btn"
              onClick={() => go("buyList", { category: cat.id, car: null })}
            >
              <span className="city-grid-title">{cat.title}</span>
              <span className="city-grid-hint">
                {cat.subtitle}
                {cat.carCount > 0 ? ` · ${cat.carCount} в каталоге` : " · скоро"}
              </span>
            </button>
          ))}
        </div>
      )}

      {nav === "usedList" && (
        <div className="phone-catalog">
          {usedMarket && (
            <p className="shop-owned">
              Рынок обновится {formatRefreshAt(usedMarket.nextRefreshAt)}. До класса «
              {usedMarket.maxClassLabel}» (+2 к салону).
            </p>
          )}
          {!usedMarket ? (
            <p className="shop-stub">Загрузка…</p>
          ) : usedMarket.listings.length === 0 ? (
            <p className="shop-stub">Сейчас нет предложений — загляните после обновления рынка.</p>
          ) : (
            <ul className="phone-list">
              {usedMarket.listings.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="phone-list-item"
                    onClick={() => {
                      setUsedListingId(l.id);
                      setUsedDetail(null);
                      go("usedDetail");
                    }}
                  >
                    <span className="phone-list-thumb" style={{ background: l.accent }} aria-hidden />
                    <span className="phone-list-info">
                      <span className="phone-list-name">
                        {l.brand} {l.model}
                        <span className="phone-list-meta"> · {l.carClassLabel}</span>
                      </span>
                      <span className="phone-list-price">
                        {rub(l.priceRub)} · {l.mileageLabel}
                      </span>
                      <span className="city-grid-hint">
                        Кузов {l.bodyCondition}% · оценка {l.overallVisible}%
                        {l.diagnosed ? " · диагностика" : ""}
                      </span>
                    </span>
                    <span className="phone-list-badge">{l.priceVsNewPct}%</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {nav === "usedDetail" && !usedSelected && <p className="shop-stub">Загрузка…</p>}

      {nav === "usedDetail" && usedSelected && (
        <div className="phone-detail">
          <CarVisual accent={usedSelected.accent} large />
          <h3 className="phone-detail-title">
            {usedSelected.brand} {usedSelected.model}
          </h3>
          <dl className="phone-specs">
            <div>
              <dt>Кузов</dt>
              <dd>{usedSelected.body}</dd>
            </div>
            <div>
              <dt>Год</dt>
              <dd>{usedSelected.year}</dd>
            </div>
            <div>
              <dt>Класс</dt>
              <dd>{usedSelected.carClassLabel}</dd>
            </div>
            <div>
              <dt>Пробег</dt>
              <dd>{usedSelected.mileageLabel}</dd>
            </div>
            <div>
              <dt>Кузов (состояние)</dt>
              <dd>{usedSelected.bodyCondition}%</dd>
            </div>
            <div>
              <dt>Общая оценка</dt>
              <dd>{usedSelected.overallVisible}%</dd>
            </div>
            <div>
              <dt>Права</dt>
              <dd>
                <span className={usedSelected.hasLicense ? "license-ok" : "license-miss"}>
                  кат. {usedSelected.licenseCategory} — {usedSelected.hasLicense ? "есть" : "нет"}
                </span>
              </dd>
            </div>
            <div>
              <dt>Цена нового в городе</dt>
              <dd>{rub(usedSelected.newPriceRub)}</dd>
            </div>
          </dl>
          {usedSelected.diagnosis && <UsedDiagnosisSpecs diagnosis={usedSelected.diagnosis} />}
          {!usedSelected.diagnosis && (
            <p className="shop-owned">
              Двигатель, КПП и электроника скрыты до покупки. Диагностика ({rub(usedSelected.diagnoseCostRub)}) покажет
              диапазоны состояния узлов — не точные значения.
            </p>
          )}
          <div className="phone-detail-buy car-detail-actions">
            <p className="shop-price">
              Цена: <strong>{rub(usedSelected.priceRub)}</strong>
              <span className="shop-owned"> ({usedSelected.priceVsNewPct}% от нового)</span>
            </p>
            {!usedSelected.hasLicense ? (
              <p className="shop-owned">Сначала получите права категории {usedSelected.licenseCategory} в полиции.</p>
            ) : (
              <>
                {!usedSelected.diagnosed && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy || p.rubles < usedSelected.diagnoseCostRub}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const r = await diagnoseUsedCar(usedSelected.id);
                        setUser(r.user);
                        onToast(
                          r.costRub > 0
                            ? `Диагностика: −${rub(r.costRub)}`
                            : "Диагностика уже была заказана",
                        );
                        setUsedDetail(await fetchUsedCarDetail(usedSelected.id));
                        const market = await fetchUsedCarMarket();
                        setUsedMarket(market);
                      } catch (e) {
                        onToast(e instanceof Error ? e.message : "Ошибка", true);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Диагностика {rub(usedSelected.diagnoseCostRub)}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || p.rubles < usedSelected.priceRub}
                  onClick={() =>
                    setPending({
                      kind: "buyUsed",
                      listingId: usedSelected.id,
                      name: `${usedSelected.brand} ${usedSelected.model}`,
                      priceRub: usedSelected.priceRub,
                    })
                  }
                >
                  Купить за {rub(usedSelected.priceRub)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {nav === "buyList" && (
        <div className="phone-catalog">
          {needsLicenseBanner && (
            <div className="card shop-license-banner">
              <p className="shop-owned">
                Для покупки нужны права категории <strong>{categoryId}</strong> — получите в{" "}
                <strong>полиции</strong> (раздел «Разные места»).
              </p>
            </div>
          )}
          {cars.length === 0 ? (
            <p className="shop-stub">В этой категории пока нет моделей.</p>
          ) : (
            <ul className="phone-list">
              {cars
                .filter((c) => c.marketAvailable !== false)
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="phone-list-item"
                      onClick={() => go("buyDetail", { car: c.id })}
                    >
                      <span className="phone-list-thumb" style={{ background: c.accent }} aria-hidden />
                      <span className="phone-list-info">
                        <span className="phone-list-name">
                          {c.brand} {c.model}
                          {c.carClassLabel ? (
                            <span className="phone-list-meta"> · {c.carClassLabel}</span>
                          ) : null}
                        </span>
                        <span className="phone-list-price">
                          {rub(c.listPriceRub ?? c.priceRub)}
                        </span>
                      </span>
                      {c.isOwned && <span className="phone-list-badge">куплено</span>}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {nav === "buyDetail" && !selected && <p className="shop-stub">Загрузка…</p>}

      {nav === "buyDetail" && selected && (
        <div className="phone-detail">
          <CarVisual accent={selected.accent} large />
          <h3 className="phone-detail-title">
            {selected.brand} {selected.model}
          </h3>
          <dl className="phone-specs">
            <div>
              <dt>Кузов</dt>
              <dd>{selected.body}</dd>
            </div>
            <div>
              <dt>Год</dt>
              <dd>{selected.year}</dd>
            </div>
            <div>
              <dt>Права</dt>
              <dd>
                <span className={selected.hasLicense ? "license-ok" : "license-miss"}>
                  кат. {selected.licenseCategory} — {selected.hasLicense ? "есть" : "нет"}
                </span>
              </dd>
            </div>
            {selected.carClassLabel && (
              <div>
                <dt>Класс</dt>
                <dd>{selected.carClassLabel}</dd>
              </div>
            )}
            <div>
              <dt>Скорость / доставка</dt>
              <dd>−{selected.cooldownReducePct}% к КД</dd>
            </div>
            {selected.comfort != null && (
              <div>
                <dt>Комфорт (такси)</dt>
                <dd>{selected.comfort}</dd>
              </div>
            )}
            {selected.prestige != null && (
              <div>
                <dt>Престиж</dt>
                <dd>{selected.prestige}</dd>
              </div>
            )}
            {selected.maintenanceMonthlyRub != null && (
              <div>
                <dt>Обслуживание</dt>
                <dd>{rub(selected.maintenanceMonthlyRub)} / мес</dd>
              </div>
            )}
            {selected.isOwned && (
              <>
                <div>
                  <dt>Статус</dt>
                  <dd>
                    <span className="license-ok">куплено</span>
                  </dd>
                </div>
                {ownedInstance?.plate && (
                  <div>
                    <dt>Гос.номер</dt>
                    <dd className="car-detail-plate">
                      <VehiclePlate parts={ownedInstance.plate} size="md" />
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>
          <div className="phone-detail-buy car-detail-actions">
            <p className="shop-price">
              Цена: <strong>{rub(selected.listPriceRub ?? selected.priceRub)}</strong>
              {selected.basePriceRub != null &&
                selected.listPriceRub != null &&
                selected.basePriceRub !== selected.listPriceRub && (
                  <span className="shop-owned">
                    {" "}
                    (база {rub(selected.basePriceRub)})
                  </span>
                )}
            </p>
            {!selected.isOwned && tradeInPriceHint(selected) && (
              <p className="shop-trade-in">{tradeInPriceHint(selected)}</p>
            )}
            {selected.isOwned && ownedInstance ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  try {
                    const q = await fetchCarSellQuote(ownedInstance.id);
                    setPending({
                      kind: "sell",
                      playerCarId: ownedInstance.id,
                      name: `${selected.brand} ${selected.model}`,
                      amountRub: q.amountRub,
                      catalogPriceRub: q.catalogPriceRub,
                      plateText: q.plateText,
                    });
                  } catch (e) {
                    onToast(e instanceof Error ? e.message : "Ошибка", true);
                  }
                }}
              >
                Продать
              </button>
            ) : selected.isOwned ? (
              <p className="shop-owned">Эта модель уже в вашем гараже.</p>
            ) : !selected.hasLicense ? (
              <p className="shop-owned">Сначала получите права категории {selected.licenseCategory} в полиции.</p>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || p.rubles < selected.priceRub}
                  onClick={() =>
                    setPending({
                      kind: "buy",
                      carId: selected.id,
                      name: `${selected.brand} ${selected.model}`,
                      priceRub: selected.priceRub,
                    })
                  }
                >
                  Купить за {rub(selected.priceRub)}
                </button>
                {ownedCars.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => go("tradeIn", { car: selected.id })}
                  >
                    Трейд-ин
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {nav === "tradeIn" && selected && (
        <div className="phone-detail">
          <CarVisual accent={selected.accent} large />
          <h3 className="phone-detail-title">
            {selected.brand} {selected.model}
          </h3>
          <p className="shop-owned">
            {selected.body} · {selected.year}
          </p>
          <p className="shop-price">
            Цена: <strong>{rub(selected.priceRub)}</strong>
          </p>
          {tradeInPriceHint(selected) && (
            <p className="shop-trade-in">{tradeInPriceHint(selected)}</p>
          )}
          <p className="shop-owned">Выберите автомобили для зачёта:</p>
          <ul className="phone-list">
            {ownedCars.map((oc) => {
              const checked = tradeInIds.includes(oc.id);
              return (
                <li key={oc.id}>
                  <label className="phone-list-item" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setTradeInIds((prev) =>
                          checked ? prev.filter((id) => id !== oc.id) : [...prev, oc.id],
                        );
                      }}
                    />
                    <span className="phone-list-thumb" style={{ background: oc.accent }} aria-hidden />
                    <span className="phone-list-info">
                      <span className="phone-list-name">
                        {oc.brand} {oc.model}
                      </span>
                      <span className="phone-list-price">зачёт ~{rub(oc.tradeInRub)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {tradeQuote && tradeInIds.length > 0 && (
            <div className="card">
              <p>
                Зачёт: <strong>{rub(tradeQuote.tradeInRub)}</strong>
              </p>
              <p>
                К оплате с выбранным зачётом: <strong>{rub(tradeQuote.netPriceRub)}</strong>
              </p>
              {tradeQuote.excessRub > 0 && (
                <p className="license-ok">
                  На баланс: <strong>+{rub(tradeQuote.excessRub)}</strong>
                </p>
              )}
            </div>
          )}
          <div className="phone-detail-buy car-detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                busy ||
                tradeInIds.length === 0 ||
                !tradeQuote ||
                p.rubles < (tradeQuote?.netPriceRub ?? 0)
              }
              onClick={() => {
                if (!tradeQuote) return;
                setPending({
                  kind: "tradeIn",
                  carId: selected.id,
                  name: `${selected.brand} ${selected.model}`,
                  quote: tradeQuote,
                  tradeInCarIds: tradeInIds,
                });
              }}
            >
              Купить
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setNav("buyDetail")}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {nav === "rent" && (
        <ul className="phone-list">
          {rentals.map((r) => (
            <li key={r.id}>
              <div className="phone-list-item" style={{ cursor: "default" }}>
                <span className="phone-list-thumb" style={{ background: r.accent }} aria-hidden />
                <span className="phone-list-info">
                  <span className="phone-list-name">{r.label}</span>
                  <span className="phone-list-price">
                    {rub(r.priceRub)} · {r.hours} ч
                  </span>
                  <span className="city-grid-hint">{r.hint}</span>
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ margin: "0.35rem 0 0.75rem" }}
                disabled={busy || p.rubles < r.priceRub}
                onClick={() =>
                  setPending({ kind: "rent", rentalId: r.id, label: r.label, priceRub: r.priceRub })
                }
              >
                Арендовать
              </button>
            </li>
          ))}
        </ul>
      )}

      {nav === "plate" && (
        <div className="phone-catalog">
          {plateGarage.length === 0 ? (
            <p className="shop-owned">Сначала купите автомобиль в разделе «Купить авто».</p>
          ) : (
            <ul className="phone-list">
              {plateGarage.map((c) => (
                <li key={c.playerCarId}>
                  <button
                    type="button"
                    className="phone-list-item"
                    onClick={() => openPlateCar(c.playerCarId)}
                  >
                    <span className="phone-list-thumb" style={{ background: c.accent }} aria-hidden />
                    <span className="phone-list-info">
                      <span className="phone-list-name">
                        {c.brand} {c.model}
                      </span>
                      <span className="phone-list-price">
                        {c.plateText ? "номер оформлен" : "без номера"}
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
      )}

      {nav === "plateDetail" && !plateInfo && <p className="shop-stub">Загрузка…</p>}

      {nav === "plateDetail" && plateInfo && (
        <div className="phone-detail">
          <CarVisual accent={plateInfo.accent} large />
          <h3 className="phone-detail-title">
            {plateInfo.brand} {plateInfo.model}
          </h3>
          <p className="shop-owned">Оформление и смена госномера</p>
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
      )}

      {nav === "tuning" && (
        <p className="shop-stub">Скоро</p>
      )}
    </>
  );
}

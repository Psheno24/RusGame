import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPlateGarage,
  fetchPlateShopCar,
  plateRegister,
  plateRollDigits,
  plateRollLetters,
  plateRollRegion,
  type PlateGarageCar,
  type PlateShopCarInfo,
} from "../../api";
import { CarCard, CarViewer, DEFAULT_REAR_PLATE_TUNING, formatRearPlateConfigSnippet, type CarDisplayInfo, type CarRearPlateTuning } from "../../components/cars";
import { PlateShopPanel } from "../../components/PlateShopPanel";
import { SliderWithNumberInput } from "../../components/ui/SliderWithNumberInput";
import { formatRub } from "../../formatRub";
import {
  createDevPlateShopInfo,
  devPlateInfoFromParts,
  devPlateRegister,
  devPlateRollDigits,
  devPlateRollLetters,
  devPlateRollRegion,
} from "./devPlateMock";

const PRESET_COLORS = [
  { label: "Бордовый", value: "#6b3030" },
  { label: "Синий", value: "#1a3a6b" },
  { label: "Зелёный", value: "#2d5a27" },
  { label: "Чёрный", value: "#1a1a1a" },
  { label: "Серебро", value: "#b8bcc4" },
  { label: "Белый", value: "#f2f2f2" },
] as const;

const DEMO_STATS = {
  carClassLabel: "Комфорт+",
  speed: 52,
  reliability: 78,
  priceRub: 2_000_000,
} as const;

const VIEWER_MODEL_ID = "toyota-camry";

export function CarViewerPage() {
  const [bodyColor, setBodyColor] = useState(PRESET_COLORS[0].value);
  const [garage, setGarage] = useState<PlateGarageCar[]>([]);
  const [playerCarId, setPlayerCarId] = useState<number | null>(null);
  const [plateInfo, setPlateInfo] = useState<PlateShopCarInfo | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [plateSpin, setPlateSpin] = useState(false);
  const [plateBusy, setPlateBusy] = useState(false);
  const [garageLoading, setGarageLoading] = useState(true);
  const [garageError, setGarageError] = useState<string | null>(null);
  const [rearPlateTuning, setRearPlateTuning] = useState<CarRearPlateTuning>({
    ...DEFAULT_REAR_PLATE_TUNING,
  });

  useEffect(() => {
    let alive = true;
    setGarageLoading(true);
    setGarageError(null);

    fetchPlateGarage()
      .then(({ cars }) => {
        if (!alive) return;
        setGarage(cars);
        setLocalMode(false);
        const preferred =
          cars.find((c) => c.modelId === VIEWER_MODEL_ID) ?? cars[0] ?? null;
        setPlayerCarId(preferred?.playerCarId ?? null);
        if (!preferred) {
          setLocalMode(true);
          setPlateInfo(createDevPlateShopInfo(null));
        }
      })
      .catch((e) => {
        if (!alive) return;
        setGarage([]);
        setLocalMode(true);
        setPlateInfo(createDevPlateShopInfo(null));
        setGarageError(e instanceof Error ? e.message : "Не удалось загрузить гараж");
      })
      .finally(() => {
        if (alive) setGarageLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const reloadPlateInfo = useCallback(async () => {
    if (localMode || playerCarId == null) return;
    setPlateInfo(await fetchPlateShopCar(playerCarId));
    const { cars } = await fetchPlateGarage();
    setGarage(cars);
  }, [localMode, playerCarId]);

  useEffect(() => {
    if (localMode || playerCarId == null) return;
    let alive = true;
    fetchPlateShopCar(playerCarId)
      .then((info) => {
        if (alive) setPlateInfo(info);
      })
      .catch((e) => {
        if (!alive) return;
        setGarageError(e instanceof Error ? e.message : "Ошибка загрузки номера");
      });
    return () => {
      alive = false;
    };
  }, [localMode, playerCarId]);

  const runPlateSpin = useCallback(async (action: () => Promise<void>) => {
    setPlateSpin(true);
    setPlateBusy(true);
    try {
      await action();
    } finally {
      setPlateBusy(false);
      setTimeout(() => setPlateSpin(false), 400);
    }
  }, []);

  const runApiPlate = useCallback(
    (fn: (id: number) => Promise<{ plateText: string }>) => async () => {
      if (playerCarId == null) return;
      await runPlateSpin(async () => {
        await fn(playerCarId);
        await reloadPlateInfo();
      });
    },
    [playerCarId, reloadPlateInfo, runPlateSpin],
  );

  const runLocalPlate = useCallback(
    (mutate: (current: NonNullable<PlateShopCarInfo["plate"]>) => PlateShopCarInfo["plate"]) =>
      async () => {
        await runPlateSpin(async () => {
          setPlateInfo((prev) => {
            const current = prev?.plate ?? devPlateRegister();
            const next = mutate(current);
            return devPlateInfoFromParts(next);
          });
        });
      },
    [runPlateSpin],
  );

  const selectedGarageCar = useMemo(
    () => garage.find((c) => c.playerCarId === playerCarId) ?? null,
    [garage, playerCarId],
  );

  useEffect(() => {
    if (selectedGarageCar?.accent) {
      setBodyColor(selectedGarageCar.accent);
    }
  }, [selectedGarageCar?.playerCarId, selectedGarageCar?.accent]);

  const car = useMemo((): CarDisplayInfo => {
    const name = selectedGarageCar
      ? `${selectedGarageCar.brand} ${selectedGarageCar.model}`
      : "Toyota Camry";

    return {
      modelId: VIEWER_MODEL_ID,
      name,
      ...DEMO_STATS,
      bodyColor,
      plate: plateInfo?.plate ?? null,
      plateText: plateInfo?.plateText ?? null,
    };
  }, [selectedGarageCar, plateInfo, bodyColor]);

  const rearPlateSnippet = useMemo(
    () => formatRearPlateConfigSnippet(VIEWER_MODEL_ID, rearPlateTuning),
    [rearPlateTuning],
  );

  return (
    <div className="dev-car-viewer">
      <header className="dev-car-viewer__header">
        <h1 className="dev-car-viewer__title">3D просмотр автомобиля</h1>
        <p className="dev-car-viewer__hint">
          Вращайте модель мышью или пальцем. Прокрутка номера — как в магазине; номер накладывается спереди и сзади.
        </p>
      </header>

      <section className="dev-car-viewer__section">
        <h2 className="dev-car-viewer__section-title">Госномер (тест)</h2>

        <div className="dev-car-viewer__plate-block">
          {garageLoading && <p className="dev-car-viewer__muted">Загрузка гаража…</p>}

          {!garageLoading && garage.length > 1 && (
            <label className="dev-car-viewer__car-select">
              <span>Машина</span>
              <select
                value={playerCarId ?? ""}
                onChange={(e) => setPlayerCarId(Number(e.target.value))}
              >
                {garage.map((c) => (
                  <option key={c.playerCarId} value={c.playerCarId}>
                    {c.brand} {c.model}
                    {c.plateText ? ` · ${c.plateText}` : " · без номера"}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!garageLoading && localMode && (
            <p className="dev-car-viewer__muted">
              {garageError
                ? `${garageError}. Локальный режим — номер крутится без API.`
                : "Нет машин в гараже — локальный режим для теста 3D."}
            </p>
          )}

          {plateInfo && (
            <PlateShopPanel
              info={plateInfo}
              spinning={plateSpin}
              busy={plateBusy}
              onRegister={
                localMode
                  ? () =>
                      void runLocalPlate(() => devPlateRegister())()
                  : runApiPlate(plateRegister)
              }
              onDigits={
                localMode
                  ? () =>
                      void runLocalPlate((cur) => devPlateRollDigits(cur))()
                  : runApiPlate(plateRollDigits)
              }
              onLetters={
                localMode
                  ? () =>
                      void runLocalPlate((cur) => devPlateRollLetters(cur))()
                  : runApiPlate(plateRollLetters)
              }
              onRegion={
                localMode
                  ? () =>
                      void runLocalPlate((cur) => devPlateRollRegion(cur))()
                  : runApiPlate(plateRollRegion)
              }
            />
          )}
        </div>
      </section>

      <section className="dev-car-viewer__section">
        <h2 className="dev-car-viewer__section-title">CarViewer</h2>

        <div className="dev-car-viewer__colors">
          <div className="dev-car-viewer__color-swatches">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`dev-car-viewer__color-btn${bodyColor === preset.value ? " dev-car-viewer__color-btn--active" : ""}`}
                style={{ background: preset.value }}
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={bodyColor === preset.value}
                onClick={() => setBodyColor(preset.value)}
              />
            ))}
          </div>
          <label className="dev-car-viewer__color-picker">
            <span>Свой цвет</span>
            <input
              type="color"
              value={bodyColor}
              onChange={(e) => setBodyColor(e.target.value)}
            />
            <code>{bodyColor}</code>
          </label>
        </div>

        <div className="dev-car-viewer__rear-tuning">
          <p className="dev-car-viewer__rear-tuning-title">Задний номер (подстройка)</p>

          <SliderWithNumberInput
            className="dev-car-viewer__slider slider-with-number"
            label="Размер"
            min={0.5}
            max={2}
            step={0.01}
            value={rearPlateTuning.sizeScale}
            onChange={(sizeScale) =>
              setRearPlateTuning((prev) => ({
                ...prev,
                sizeScale,
              }))
            }
          />

          <SliderWithNumberInput
            className="dev-car-viewer__slider slider-with-number"
            label="Выше / ниже"
            min={-0.2}
            max={0.2}
            step={0.002}
            value={rearPlateTuning.offsetY}
            onChange={(offsetY) =>
              setRearPlateTuning((prev) => ({
                ...prev,
                offsetY,
              }))
            }
          />

          <div className="dev-car-viewer__rear-tuning-actions">
            <button
              type="button"
              className="btn btn-secondary dev-car-viewer__reset-btn"
              onClick={() => setRearPlateTuning({ ...DEFAULT_REAR_PLATE_TUNING })}
            >
              Сброс
            </button>
          </div>

          {rearPlateSnippet && (
            <div className="dev-car-viewer__snippet">
              <p className="dev-car-viewer__muted">
                Скопируйте в <code>carPlateConfig.ts</code> для модели <code>{VIEWER_MODEL_ID}</code>:
              </p>
              <pre>{rearPlateSnippet}</pre>
            </div>
          )}
        </div>

        <CarViewer
          modelId={car.modelId}
          bodyColor={bodyColor}
          plate={car.plate}
          plateText={car.plateText}
          rearPlateTuning={rearPlateTuning}
          height={320}
        />
      </section>

      <section className="dev-car-viewer__section">
        <h2 className="dev-car-viewer__section-title">CarCard</h2>
        <CarCard car={car} />
      </section>

      <section className="dev-car-viewer__section">
        <h2 className="dev-car-viewer__section-title">Данные</h2>
        <dl className="phone-specs dev-car-viewer__data">
          <div>
            <dt>Модель</dt>
            <dd>{car.name}</dd>
          </div>
          <div>
            <dt>ID</dt>
            <dd>{car.modelId}</dd>
          </div>
          <div>
            <dt>Номер</dt>
            <dd>{car.plateText ?? "—"}</dd>
          </div>
          <div>
            <dt>Режим</dt>
            <dd>{localMode ? "локальный" : "API магазина"}</dd>
          </div>
          <div>
            <dt>Цена (демо)</dt>
            <dd>{formatRub(car.priceRub)}</dd>
          </div>
          <div>
            <dt>GLB</dt>
            <dd>/models/cars/camry.glb</dd>
          </div>
        </dl>
      </section>

      <style>{`
        .dev-car-viewer {
          padding: 16px;
          padding-bottom: calc(var(--bottom-nav-height) + 24px);
          display: flex;
          flex-direction: column;
          gap: 24px;
          overflow-y: auto;
          height: 100%;
        }
        .dev-car-viewer__header {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dev-car-viewer__title {
          margin: 0;
          font-size: 1.25rem;
        }
        .dev-car-viewer__hint {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.45;
        }
        .dev-car-viewer__section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .dev-car-viewer__section-title {
          margin: 0;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }
        .dev-car-viewer__plate-block,
        .dev-car-viewer__colors,
        .dev-car-viewer__rear-tuning {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-elevated);
        }
        .dev-car-viewer__rear-tuning-title {
          margin: 0;
          font-size: 0.88rem;
          font-weight: 600;
        }
        .dev-car-viewer__slider {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.88rem;
        }
        .dev-car-viewer__rear-tuning-actions {
          display: flex;
          gap: 8px;
        }
        .dev-car-viewer__reset-btn {
          font-size: 0.85rem;
          padding: 6px 12px;
        }
        .dev-car-viewer__snippet pre {
          margin: 0;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          font-size: 0.78rem;
          line-height: 1.45;
          overflow-x: auto;
          white-space: pre;
        }
        .dev-car-viewer__muted {
          margin: 0;
          font-size: 0.88rem;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .dev-car-viewer__car-select {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.88rem;
        }
        .dev-car-viewer__car-select select {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text);
          font: inherit;
        }
        .dev-car-viewer__color-swatches {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .dev-car-viewer__color-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
        }
        .dev-car-viewer__color-btn--active {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--ring);
        }
        .dev-car-viewer__color-picker {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.88rem;
        }
        .dev-car-viewer__color-picker input {
          width: 44px;
          height: 32px;
          padding: 0;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
        }
        .dev-car-viewer__color-picker code {
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .dev-car-viewer__data {
          margin: 0;
        }
      `}</style>
    </div>
  );
}

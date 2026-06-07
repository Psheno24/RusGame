import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { VehiclePlateParts } from "../../api";
import {
  fetchAdminCar3dDisplay,
  fetchAdminCar3dModels,
  saveAdminCar3dDisplay,
  type Car3dModelListItem,
} from "../../api";
import { CarViewer } from "../../components/cars/CarViewer";
import {
  DEFAULT_PLATE_DISPLAY_TUNING,
  mergeCardDisplayConfig,
  mergePlateDisplayTuning,
  type CarCardDisplayConfig,
  type CarPlateDisplayTuning,
  type CarViewStateSnapshot,
} from "../../components/cars/carDisplayConfig";
import { clearCar3dDisplayCache, primeCar3dDisplayCache } from "../../components/cars/useCar3dDisplay";
import { useNotice } from "../../noticeContext";
import { ADMIN_CAR3D_EDIT_STYLES } from "./adminCar3dStyles";

const DEMO_PLATE: VehiclePlateParts = {
  l1: "А",
  l2: "ВС",
  digits: "183",
  region: "98",
};

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  disabled?: boolean;
  onChange: (v: number) => void;
};

function TuningSlider({
  label,
  value,
  min,
  max,
  step,
  format = (v) => String(v),
  disabled,
  onChange,
}: SliderProps) {
  return (
    <label className="admin-car3d-slider">
      <span>
        {label}: <strong>{format(value)}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function AdminCar3dEditPage({ modelId }: { modelId: string }) {
  const { showNotice } = useNotice();
  const viewStateRef = useRef<CarViewStateSnapshot | null>(null);

  const [carInfo, setCarInfo] = useState<Car3dModelListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [savedPlate, setSavedPlate] = useState<CarPlateDisplayTuning>(DEFAULT_PLATE_DISPLAY_TUNING);
  const [draftPlate, setDraftPlate] = useState<CarPlateDisplayTuning>(DEFAULT_PLATE_DISPLAY_TUNING);
  const [plateEditing, setPlateEditing] = useState(false);
  const [plateSaving, setPlateSaving] = useState(false);

  const [savedCard, setSavedCard] = useState<CarCardDisplayConfig>(mergeCardDisplayConfig(null));
  const [draftCard, setDraftCard] = useState<CarCardDisplayConfig>(mergeCardDisplayConfig(null));
  const [cardEditing, setCardEditing] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [liveCardView, setLiveCardView] = useState<CarViewStateSnapshot | null>(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchAdminCar3dModels(), fetchAdminCar3dDisplay(modelId)])
      .then(([{ models }, displayRes]) => {
        if (!alive) return;
        const info = models.find((m) => m.modelId === modelId) ?? null;
        if (!info) {
          setError("Машина не найдена или нет 3D-модели");
          return;
        }
        setCarInfo(info);

        const plate = mergePlateDisplayTuning(displayRes.display?.plate);
        const card = mergeCardDisplayConfig(displayRes.display?.card);
        setSavedPlate(plate);
        setDraftPlate(plate);
        setSavedCard(card);
        setDraftCard(card);
        setPlateEditing(!displayRes.display?.plate);
        setCardEditing(!displayRes.display?.card?.fixed);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [modelId]);

  const activePlate = plateEditing ? draftPlate : savedPlate;
  const activeCard = cardEditing ? draftCard : savedCard;

  const cardPreviewDisplay = useMemo(
    (): CarCardDisplayConfig => ({
      ...activeCard,
      fixed: !cardEditing && activeCard.fixed,
    }),
    [activeCard, cardEditing],
  );

  const configJson = useMemo(() => {
    let card: CarCardDisplayConfig = cardEditing ? { ...draftCard, fixed: false } : savedCard;
    if (cardEditing && liveCardView) {
      card = {
        fixed: true,
        azimuth: liveCardView.azimuth,
        elevation: liveCardView.elevation,
        distanceRatio: liveCardView.distanceRatio,
        modelOffsetX: liveCardView.modelOffsetX,
        modelOffsetY: liveCardView.modelOffsetY,
        modelOffsetZ: liveCardView.modelOffsetZ,
        targetX: liveCardView.targetX,
        targetY: liveCardView.targetY,
        targetZ: liveCardView.targetZ,
      };
    }
    const entry = {
      plate: plateEditing ? draftPlate : savedPlate,
      card,
    };
    return JSON.stringify({ [modelId]: entry }, null, 2);
  }, [
    modelId,
    plateEditing,
    draftPlate,
    savedPlate,
    cardEditing,
    draftCard,
    savedCard,
    liveCardView,
  ]);

  const carDisplay = useMemo(
    () =>
      carInfo
        ? {
            modelId,
            name: `${carInfo.brand} ${carInfo.model}`,
            carClassLabel: "—",
            speed: 0,
            reliability: 0,
            priceRub: 0,
            bodyColor: carInfo.accent,
            plate: DEMO_PLATE,
            plateText: "А183ВС 98",
          }
        : null,
    [carInfo, modelId],
  );

  const savePlate = useCallback(async () => {
    setPlateSaving(true);
    try {
      const { display } = await saveAdminCar3dDisplay(modelId, { plate: draftPlate });
      const next = mergePlateDisplayTuning(display?.plate);
      setSavedPlate(next);
      setDraftPlate(next);
      setPlateEditing(false);
      primeCar3dDisplayCache(modelId, { plate: next, card: savedCard });
      showNotice("Настройки номеров сохранены", "success");
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка сохранения", "error");
    } finally {
      setPlateSaving(false);
    }
  }, [draftPlate, modelId, savedCard, showNotice]);

  const saveCard = useCallback(async () => {
    const snap = viewStateRef.current;
    const nextCard: CarCardDisplayConfig = snap
      ? {
          fixed: true,
          azimuth: snap.azimuth,
          elevation: snap.elevation,
          distanceRatio: snap.distanceRatio,
          modelOffsetX: snap.modelOffsetX,
          modelOffsetY: snap.modelOffsetY,
          modelOffsetZ: snap.modelOffsetZ,
          targetX: snap.targetX,
          targetY: snap.targetY,
          targetZ: snap.targetZ,
        }
      : { ...draftCard, fixed: true };

    setCardSaving(true);
    try {
      const { display } = await saveAdminCar3dDisplay(modelId, { card: nextCard });
      const merged = mergeCardDisplayConfig(display?.card);
      setSavedCard(merged);
      setDraftCard(merged);
      setCardEditing(false);
      clearCar3dDisplayCache(modelId);
      primeCar3dDisplayCache(modelId, { plate: savedPlate, card: merged });
      showNotice("Вид карточки зафиксирован", "success");
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка сохранения", "error");
    } finally {
      setCardSaving(false);
    }
  }, [draftCard, modelId, savedPlate, showNotice]);

  if (loading) {
    return (
      <div className="admin-car3d-page">
        <p className="admin-car3d-page__muted">Загрузка…</p>
      </div>
    );
  }

  if (error || !carInfo || !carDisplay) {
    return (
      <div className="admin-car3d-page">
        <Link className="settings-back-link" to="/admin/car-3d">
          ← Список машин
        </Link>
        <p className="admin-car3d-page__error" role="alert">
          {error ?? "Не удалось загрузить машину"}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-car3d-page admin-car3d-edit">
      <Link className="settings-back-link" to="/admin/car-3d">
        ← Список машин
      </Link>

      <header className="admin-car3d-page__header">
        <h1 className="admin-car3d-page__title">
          {carInfo.brand} {carInfo.model}
        </h1>
        <p className="admin-car3d-page__hint">
          Настройте номера и вид карточки. После «Готово» / «Зафиксировать» настройки сохраняются в проект.
        </p>
      </header>

      <section className="admin-car3d-section">
        <div className="admin-car3d-section__head">
          <h2 className="admin-car3d-section__title">Госномера</h2>
          {plateEditing ? (
            <button
              className="btn btn-primary admin-car3d-section__btn"
              type="button"
              disabled={plateSaving}
              onClick={() => void savePlate()}
            >
              {plateSaving ? "Сохранение…" : "Готово"}
            </button>
          ) : (
            <button
              className="btn btn-secondary admin-car3d-section__btn"
              type="button"
              onClick={() => {
                setDraftPlate(savedPlate);
                setPlateEditing(true);
              }}
            >
              Изменить
            </button>
          )}
        </div>

        <div className="admin-car3d-tuning">
          <TuningSlider
            label="Размер (оба номера)"
            value={activePlate.sizeScale}
            min={0.5}
            max={2}
            step={0.01}
            format={(v) => `${v.toFixed(2)}×`}
            disabled={!plateEditing}
            onChange={(sizeScale) => setDraftPlate((p) => ({ ...p, sizeScale }))}
          />
          <TuningSlider
            label="Передний — влево / вправо"
            value={activePlate.front.offsetX}
            min={-1}
            max={1}
            step={0.01}
            format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            disabled={!plateEditing}
            onChange={(offsetX) =>
              setDraftPlate((p) => ({ ...p, front: { ...p.front, offsetX } }))
            }
          />
          <TuningSlider
            label="Передний — выше / ниже"
            value={activePlate.front.offsetY}
            min={-1}
            max={1}
            step={0.01}
            format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            disabled={!plateEditing}
            onChange={(offsetY) =>
              setDraftPlate((p) => ({ ...p, front: { ...p.front, offsetY } }))
            }
          />
          <TuningSlider
            label="Задний — влево / вправо"
            value={activePlate.rear.offsetX}
            min={-1}
            max={1}
            step={0.01}
            format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            disabled={!plateEditing}
            onChange={(offsetX) =>
              setDraftPlate((p) => ({ ...p, rear: { ...p.rear, offsetX } }))
            }
          />
          <TuningSlider
            label="Задний — выше / ниже"
            value={activePlate.rear.offsetY}
            min={-1}
            max={1}
            step={0.01}
            format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            disabled={!plateEditing}
            onChange={(offsetY) =>
              setDraftPlate((p) => ({ ...p, rear: { ...p.rear, offsetY } }))
            }
          />
        </div>

        <CarViewer
          modelId={modelId}
          bodyColor={carInfo.accent}
          plate={DEMO_PLATE}
          plateText="А183ВС 98"
          plateTuning={activePlate}
          height={300}
        />
      </section>

      <section className="admin-car3d-section">
        <div className="admin-car3d-section__head">
          <h2 className="admin-car3d-section__title">Карточка в магазине</h2>
          {cardEditing ? (
            <button
              className="btn btn-primary admin-car3d-section__btn"
              type="button"
              disabled={cardSaving}
              onClick={() => void saveCard()}
            >
              {cardSaving ? "Сохранение…" : "Зафиксировать"}
            </button>
          ) : (
            <button
              className="btn btn-secondary admin-car3d-section__btn"
              type="button"
              onClick={() => {
                setDraftCard(savedCard);
                setCardEditing(true);
              }}
            >
              Изменить
            </button>
          )}
        </div>

        <div className="admin-car3d-tuning">
          <TuningSlider
            label="Смещение — влево / вправо"
            value={cardEditing ? draftCard.modelOffsetX : activeCard.modelOffsetX}
            min={-1.5}
            max={1.5}
            step={0.01}
            format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            disabled={!cardEditing}
            onChange={(modelOffsetX) => setDraftCard((c) => ({ ...c, modelOffsetX }))}
          />
          <TuningSlider
            label="Смещение — выше / ниже"
            value={cardEditing ? draftCard.modelOffsetY : activeCard.modelOffsetY}
            min={-1.5}
            max={1.5}
            step={0.01}
            format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            disabled={!cardEditing}
            onChange={(modelOffsetY) => setDraftCard((c) => ({ ...c, modelOffsetY }))}
          />
          <TuningSlider
            label="Смещение — ближе / дальше"
            value={cardEditing ? draftCard.modelOffsetZ : activeCard.modelOffsetZ}
            min={-1.5}
            max={1.5}
            step={0.01}
            format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
            disabled={!cardEditing}
            onChange={(modelOffsetZ) => setDraftCard((c) => ({ ...c, modelOffsetZ }))}
          />
          {!cardEditing && activeCard.fixed && (
            <p className="admin-car3d-page__muted">Ракурс зафиксирован — так машина будет в магазине.</p>
          )}
          {cardEditing && (
            <p className="admin-car3d-page__muted">
              Покрутите модель в карточке ниже, отцентрируйте ползунками, затем нажмите «Зафиксировать».
            </p>
          )}
        </div>

        <div className="admin-car3d-card-preview">
          <CarViewer
            modelId={modelId}
            bodyColor={carInfo.accent}
            plate={DEMO_PLATE}
            plateText="А183ВС 98"
            plateTuning={savedPlate}
            height={220}
            enableZoom={cardEditing}
            lockCamera={!cardEditing && savedCard.fixed}
            cardDisplay={cardPreviewDisplay}
            modelOffset={
              cardEditing
                ? {
                    x: draftCard.modelOffsetX,
                    y: draftCard.modelOffsetY,
                    z: draftCard.modelOffsetZ,
                  }
                : undefined
            }
            viewStateRef={cardEditing ? viewStateRef : undefined}
            onViewStateChange={cardEditing ? setLiveCardView : undefined}
          />
          <p className="admin-car3d-card-preview__title">{carDisplay.name}</p>
        </div>
      </section>

      <section className="admin-car3d-section admin-car3d-json">
        <div className="admin-car3d-section__head">
          <h2 className="admin-car3d-section__title">JSON (car-3d-display.json)</h2>
          <button
            className="btn btn-secondary admin-car3d-section__btn"
            type="button"
            onClick={() => setShowJson((v) => !v)}
          >
            {showJson ? "Скрыть" : "Показать"}
          </button>
        </div>
        {showJson && (
          <>
            <p className="admin-car3d-page__muted">
              {plateEditing || cardEditing
                ? "Черновик — после «Готово» / «Зафиксировать» попадёт в проект."
                : "Текущие сохранённые значения для этой машины."}
            </p>
            <pre className="admin-car3d-json__pre">{configJson}</pre>
          </>
        )}
      </section>

      <style>{ADMIN_CAR3D_EDIT_STYLES}</style>
    </div>
  );
}

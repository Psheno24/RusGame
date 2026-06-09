import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNotice } from "../noticeContext";
import {
  loadNotificationPrefs,
  pushSupported,
  setHousingPaymentNotifications,
  setRelocationNotifications,
  setShiftReadyNotifications,
} from "../pushNotifications";

type ToggleKey = "shiftReady" | "housingPayment" | "relocation";

const TOGGLES: Array<{
  key: ToggleKey;
  title: string;
  desc: string;
  enable: (v: boolean) => Promise<string | null>;
}> = [
  {
    key: "shiftReady",
    title: "Смена",
    desc: "Работа, такси и доставка: когда снова можно выйти на смену или взять заказ",
    enable: setShiftReadyNotifications,
  },
  {
    key: "housingPayment",
    title: "Оплата жилья",
    desc: "Квартира — за 7 и 1 день до конца аренды, общежитие — за 1 день",
    enable: setHousingPaymentNotifications,
  },
  {
    key: "relocation",
    title: "Переезд",
    desc: "Когда поездка в другой город завершена",
    enable: setRelocationNotifications,
  },
];

export function ProfileNotificationsPage() {
  const { showNotice } = useNotice();
  const [prefs, setPrefs] = useState<Record<ToggleKey, boolean>>({
    shiftReady: false,
    housingPayment: false,
    relocation: false,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ToggleKey | null>(null);
  const supported = pushSupported();

  useEffect(() => {
    let cancelled = false;
    void loadNotificationPrefs()
      .then((loaded) => {
        if (!cancelled) {
          setPrefs({
            shiftReady: loaded.shiftReady,
            housingPayment: loaded.housingPayment,
            relocation: loaded.relocation,
          });
        }
      })
      .catch(() => {
        if (!cancelled) showNotice("Не удалось загрузить настройки уведомлений");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showNotice]);

  const onToggle = useCallback(
    async (key: ToggleKey) => {
      if (busy || loading) return;
      const toggle = TOGGLES.find((t) => t.key === key);
      if (!toggle) return;
      const next = !prefs[key];
      setBusy(key);
      try {
        const err = await toggle.enable(next);
        if (err) {
          showNotice(err);
          return;
        }
        setPrefs((cur) => ({ ...cur, [key]: next }));
      } catch (e) {
        showNotice(e instanceof Error ? e.message : "Ошибка сохранения");
      } finally {
        setBusy(null);
      }
    },
    [busy, loading, prefs, showNotice],
  );

  return (
    <div className="profile-page settings-page">
      <div className="profile-page-content">
        <div className="settings-back-row">
          <Link className="settings-back-link" to="/profile/settings">
            ← Настройки
          </Link>
        </div>
        <div className="card">
          <h2>Уведомления</h2>
          {!supported && (
            <p className="settings-hint">
              Push-уведомления доступны в установленном PWA или в браузере с поддержкой Web Push.
            </p>
          )}
          <ul className="settings-toggle-list">
            {TOGGLES.map((toggle) => {
              const on = prefs[toggle.key];
              return (
                <li key={toggle.key} className="settings-toggle-item">
                  <div className="settings-toggle-copy">
                    <span className="settings-toggle-title">{toggle.title}</span>
                    <span className="settings-toggle-desc">{toggle.desc}</span>
                  </div>
                  <button
                    type="button"
                    className={`settings-toggle${on ? " settings-toggle--on" : ""}`}
                    role="switch"
                    aria-checked={on}
                    aria-label={toggle.title}
                    disabled={!supported || loading || busy != null}
                    onClick={() => void onToggle(toggle.key)}
                  >
                    <span className="settings-toggle-knob" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

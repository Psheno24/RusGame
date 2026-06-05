import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNotice } from "../noticeContext";
import { loadNotificationPrefs, pushSupported, setShiftReadyNotifications } from "../pushNotifications";

export function ProfileNotificationsPage() {
  const { showNotice } = useNotice();
  const [shiftReady, setShiftReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    let cancelled = false;
    void loadNotificationPrefs()
      .then((prefs) => {
        if (!cancelled) setShiftReady(prefs.shiftReady);
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

  const onToggleShiftReady = useCallback(async () => {
    if (busy || loading) return;
    const next = !shiftReady;
    setBusy(true);
    try {
      const err = await setShiftReadyNotifications(next);
      if (err) {
        showNotice(err);
        return;
      }
      setShiftReady(next);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }, [busy, loading, shiftReady, showNotice]);

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
            <li className="settings-toggle-item">
              <div className="settings-toggle-copy">
                <span className="settings-toggle-title">Смена доступна</span>
                <span className="settings-toggle-desc">
                  Когда снова можно работать: после кулдауна смены или поездки такси
                </span>
              </div>
              <button
                type="button"
                className={`settings-toggle${shiftReady ? " settings-toggle--on" : ""}`}
                role="switch"
                aria-checked={shiftReady}
                aria-label="Смена доступна"
                disabled={!supported || loading || busy}
                onClick={() => void onToggleShiftReady()}
              >
                <span className="settings-toggle-knob" aria-hidden />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

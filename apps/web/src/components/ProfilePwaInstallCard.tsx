import { useCallback, useEffect, useState } from "react";
import {
  type BeforeInstallPromptEvent,
  isIos,
  isIosSafari,
  isPwaInstalled,
  openInSafari,
} from "../pwaInstall";

export function ProfilePwaInstallCard() {
  const [installed, setInstalled] = useState(isPwaInstalled);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onDisplayModeChange = () => setInstalled(isPwaInstalled());
    const media = window.matchMedia("(display-mode: standalone)");

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    media.addEventListener("change", onDisplayModeChange);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      media.removeEventListener("change", onDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const onInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return;
    }
    setShowHelp(true);
  }, [deferredPrompt]);

  if (installed) return null;

  const ios = isIos();
  const iosSafari = isIosSafari();

  const helpText = iosSafari
    ? "Нажмите «Поделиться» внизу экрана, затем «На экран Домой»."
    : ios
      ? "На iPhone добавить на рабочий стол можно только через Safari. Откройте эту страницу в Safari, нажмите «Поделиться» и выберите «На экран Домой»."
      : "Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».";

  const showOpenInSafari = ios && !iosSafari;

  return (
    <>
      <div className="card profile-pwa-install-card">
        <button className="btn btn-primary profile-pwa-install-btn" type="button" onClick={() => void onInstall()}>
          Добавить на рабочий стол
        </button>
        <p className="profile-pwa-install-hint">
          Можно добавить иконку на телефон, чтобы было без адресной строки и выглядело, как обычное
          приложение на телефоне
        </p>
      </div>

      {showHelp && (
        <div className="confirm-backdrop" role="presentation" onClick={() => setShowHelp(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-labelledby="pwa-install-help-title"
            aria-describedby="pwa-install-help-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pwa-install-help-title" className="confirm-dialog-title">
              Как добавить на рабочий стол
            </h2>
            <p id="pwa-install-help-desc" className="confirm-dialog-text">
              {helpText}
            </p>
            <div className="confirm-dialog-actions">
              {showOpenInSafari && (
                <button className="btn btn-primary" type="button" onClick={() => openInSafari()}>
                  Открыть в Safari
                </button>
              )}
              <button
                className={`btn${showOpenInSafari ? " btn-secondary" : " btn-primary"}`}
                type="button"
                onClick={() => setShowHelp(false)}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

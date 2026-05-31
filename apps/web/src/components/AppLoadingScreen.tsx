export function AppLoadingScreen() {
  return (
    <div className="app-loading-screen" role="status" aria-live="polite" aria-label="Загрузка приложения">
      <div className="app-loading-inner">
        <div className="app-loading-mark" aria-hidden>
          <span className="app-loading-ring" />
          <span className="app-loading-core" />
        </div>
        <div className="app-loading-copy">
          <span className="app-loading-title">Россия — жизнь</span>
          <span className="app-loading-text">Загрузка…</span>
        </div>
      </div>
    </div>
  );
}

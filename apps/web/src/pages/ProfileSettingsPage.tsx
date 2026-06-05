import { Link } from "react-router-dom";

export function ProfileSettingsPage() {
  return (
    <div className="profile-page settings-page">
      <div className="profile-page-content">
        <div className="settings-back-row">
          <Link className="settings-back-link" to="/profile">
            ← Профиль
          </Link>
        </div>
        <div className="card">
          <h2>Настройки</h2>
          <nav className="settings-list" aria-label="Разделы настроек">
            <Link className="settings-list-item" to="/profile/settings/notifications">
              <span className="settings-list-item-label">Уведомления</span>
              <span className="settings-list-item-chevron" aria-hidden>
                ›
              </span>
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

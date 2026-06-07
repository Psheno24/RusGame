import { useState } from "react";
import { Link } from "react-router-dom";
import { SKILL_LABELS, SKILL_ORDER } from "../api";
import { cityDisplayName } from "../cityNames";
import { TestAdminPanel } from "../components/TestAdminPanel";
import { ProfilePropertyCards } from "../components/ProfilePropertyCards";
import { VitalsBar } from "../components/VitalsBar";
import { useApp } from "../context";

const EDUCATION_LABELS: Record<string, string> = {
  none: "Без образования",
  college: "Колледж",
  university: "ВУЗ",
  masters: "Магистратура",
};

export function ProfilePage() {
  const { user, logout } = useApp();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const p = user?.player;
  if (!p) return null;

  return (
    <div className="profile-page">
      <div className="profile-page-content">
        <div className="card">
          <h2>{p.displayName}</h2>
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-label">Город</span>
              <span className="profile-stat-value">{cityDisplayName(p.cityId)}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-label">Образование</span>
              <span className="profile-stat-value">
                {EDUCATION_LABELS[p.education ?? "none"] ?? p.education}
              </span>
            </div>
          </div>
          {p.vitals && (
            <section className="profile-section">
              <h3 className="profile-section-title">Показатели</h3>
              <VitalsBar vitals={p.vitals} />
            </section>
          )}
          <section className="profile-section">
            <h3 className="profile-section-title">Навыки</h3>
            <div className="skill-grid">
              {SKILL_ORDER.map((k) => (
                <div key={k} className="skill-item">
                  {SKILL_LABELS[k]}: <strong>{p.skills[k] ?? 0}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="profile-section">
            <h3 className="profile-section-title">Имущество</h3>
            <ProfilePropertyCards />
          </section>
        </div>

        {user?.isTest && <TestAdminPanel />}

        {user?.isAdmin && (
          <div className="card">
            <h2>Админ</h2>
            <p className="test-admin-hint">
              Настройка 3D-моделей, номеров и карточек машин в магазине.
            </p>
            <div className="test-admin-actions">
              <Link className="btn btn-secondary" to="/admin/car-3d">
                Номера авто
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="profile-page-footer">
        <Link className="btn btn-secondary profile-settings-btn" to="/profile/settings">
          Настройки
        </Link>
        <button className="btn btn-logout" type="button" onClick={() => setConfirmLogout(true)}>
          Выйти
        </button>
      </div>

      {confirmLogout && (
        <div
          className="confirm-backdrop"
          role="presentation"
          onClick={() => setConfirmLogout(false)}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="logout-confirm-title" className="confirm-dialog-title">
              Выйти из аккаунта?
            </h2>
            <p id="logout-confirm-desc" className="confirm-dialog-text">
              Сессия завершится, для игры нужно будет войти снова.
            </p>
            <div className="confirm-dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setConfirmLogout(false)}>
                Отмена
              </button>
              <button
                className="btn btn-logout"
                type="button"
                onClick={() => {
                  setConfirmLogout(false);
                  void logout();
                }}
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

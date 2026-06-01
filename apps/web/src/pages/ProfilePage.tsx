import { useState } from "react";
import { SKILL_LABELS } from "../api";
import { cityDisplayName } from "../cityNames";
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
              <span className="profile-stat-label">Статус</span>
              <span className="profile-stat-value">
                {(p.isResident ?? false) ? "Житель" : "Гость"}
                {p.housingExpiresAt && p.isResident && p.housingType !== "owned"
                  ? ` · до ${new Date(p.housingExpiresAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                    })}`
                  : null}
              </span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-label">Образование</span>
              <span className="profile-stat-value">
                {EDUCATION_LABELS[p.education ?? "none"] ?? p.education}
              </span>
            </div>
          </div>
          {p.vitals && (
            <>
              <h3 className="profile-skills-title">Показатели</h3>
              <VitalsBar vitals={p.vitals} />
            </>
          )}
          <h3 className="profile-skills-title">Имущество</h3>
          <ProfilePropertyCards />
          <h3 className="profile-skills-title">Навыки</h3>
          <div className="skill-grid">
            {(Object.entries(p.skills) as [string, number][]).map(([k, v]) => (
              <div key={k} className="skill-item">
                {SKILL_LABELS[k] ?? k}: <strong>{v}</strong>
              </div>
            ))}
          </div>
        </div>

        {user?.isAdmin && (
          <div className="card">
            <h2>Админ</h2>
            <p>
              Один раз откройте{" "}
              <code style={{ fontSize: "0.8rem" }}>POST /api/admin/seed</code> чтобы создать admin (см. README).
            </p>
          </div>
        )}
      </div>

      <div className="profile-page-footer">
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

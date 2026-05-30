import { SKILL_LABELS } from "../api";
import { cityDisplayName } from "../cityNames";
import { useApp } from "../context";

export function ProfilePage() {
  const { user, logout } = useApp();
  const p = user?.player;
  if (!p) return null;

  return (
    <>
      <div className="card">
        <h2>{p.displayName}</h2>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-label">Город</span>
            <span className="profile-stat-value">{cityDisplayName(p.cityId)}</span>
          </div>
        </div>
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

      <button className="btn btn-secondary" type="button" onClick={() => logout()}>
        Выйти
      </button>
    </>
  );
}

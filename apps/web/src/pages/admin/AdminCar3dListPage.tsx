import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminCar3dModels, type Car3dModelListItem } from "../../api";

export function AdminCar3dListPage() {
  const [models, setModels] = useState<Car3dModelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAdminCar3dModels()
      .then(({ models: list }) => {
        if (alive) setModels(list);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="admin-car3d-page">
      <Link className="settings-back-link" to="/profile">
        ← Профиль
      </Link>

      <header className="admin-car3d-page__header">
        <h1 className="admin-car3d-page__title">3D — номера и карточки</h1>
        <p className="admin-car3d-page__hint">
          Машины с загруженной GLB-моделью. Настройка госномеров и вида карточки в магазине.
        </p>
      </header>

      {loading && <p className="admin-car3d-page__muted">Загрузка…</p>}
      {error && (
        <p className="admin-car3d-page__error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && models.length === 0 && (
        <p className="admin-car3d-page__muted">Нет машин с 3D-моделью.</p>
      )}

      <ul className="admin-car3d-list">
        {models.map((car) => (
          <li key={car.modelId}>
            <Link className="admin-car3d-list__item" to={`/admin/car-3d/${car.modelId}`}>
              <span
                className="admin-car3d-list__swatch"
                style={{ background: car.accent }}
                aria-hidden
              />
              <span className="admin-car3d-list__name">
                {car.brand} {car.model}
              </span>
              <span className="admin-car3d-list__meta">{car.glbFile}</span>
            </Link>
          </li>
        ))}
      </ul>

      <style>{`
        .admin-car3d-page {
          padding: 16px;
          padding-bottom: calc(var(--bottom-nav-height) + 24px);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .admin-car3d-page__header {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .admin-car3d-page__title {
          margin: 0;
          font-size: 1.25rem;
        }
        .admin-car3d-page__hint,
        .admin-car3d-page__muted {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.45;
        }
        .admin-car3d-page__error {
          margin: 0;
          color: var(--danger, #e57373);
          font-size: 0.9rem;
        }
        .admin-car3d-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .admin-car3d-list__item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-elevated);
          text-decoration: none;
          color: inherit;
        }
        .admin-car3d-list__item:hover {
          border-color: var(--accent);
        }
        .admin-car3d-list__swatch {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
        }
        .admin-car3d-list__name {
          font-weight: 600;
          flex: 1;
        }
        .admin-car3d-list__meta {
          font-size: 0.78rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

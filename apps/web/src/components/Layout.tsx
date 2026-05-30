import { NavLink, Outlet } from "react-router-dom";
import { useApp } from "../context";

const NAV_ITEMS = [
  {
    to: "/map",
    label: "Карта",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M4 6.5 9 4l7 3.5 4-2v11l-4 2-7-3.5L4 17.5V6.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: "/city",
    label: "Город",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M5 20V9l7-4 7 4v11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M9 20v-5h6v5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/profile",
    label: "Профиль",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="8" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

export function Layout() {
  const { user } = useApp();
  const p = user?.player;

  return (
    <div className="app-shell">
      {p && (
        <header className="app-header">
          <div className="money-bar">
            <span>{p.displayName}</span>
            <span>{p.rubles.toLocaleString("ru-RU")} ₽</span>
          </div>
        </header>
      )}
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Основное меню">
        <div className="bottom-nav-inner">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item-icon">{icon}</span>
              <span className="nav-item-label">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

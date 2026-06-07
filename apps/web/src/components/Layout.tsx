import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { useCityNav } from "../cityNav";
import { useApp } from "../context";
import { cityDisplayName } from "../cityNames";
import { useHomeNav } from "../homeNav";
import { useWorkNav } from "../workNav";
import { formatRub } from "../formatRub.js";

const PAGE_TITLES: { path: string; title: string }[] = [
  { path: "/home", title: "Мой дом" },
  { path: "/map", title: "Карта" },
  { path: "/work", title: "Моя работа" },
  { path: "/city", title: "Город" },
  { path: "/activity", title: "Активность" },
  { path: "/profile", title: "Профиль" },
  { path: "/profile/settings", title: "Настройки" },
  { path: "/profile/settings/notifications", title: "Уведомления" },
  { path: "/dev/car-viewer", title: "3D авто" },
  { path: "/admin/car-3d", title: "3D авто" },
];

const NAV_ITEMS = [
  {
    to: "/home",
    label: "Мой дом",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M4 11.5 12 5l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9V20.5H5.5A1.5 1.5 0 0 1 4 19v-7.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/work",
    label: "Моя работа",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect
          x="4"
          y="8"
          width="16"
          height="11"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M9 8V6.5a3 3 0 0 1 6 0V8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
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
    to: "/activity",
    label: "Активность",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M6 5h12M6 9h12M6 13h8M6 17h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="17" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
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

function pageTitle(pathname: string): string | null {
  const sorted = [...PAGE_TITLES].sort((a, b) => b.path.length - a.path.length);
  const match = sorted.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`));
  return match?.title ?? null;
}

export function Layout() {
  const { user } = useApp();
  const p = user?.player;
  const location = useLocation();
  const cityNav = useCityNav();
  const workNav = useWorkNav();
  const homeNav = useHomeNav();
  const headerTitle = pageTitle(location.pathname);

  const onCityNavClick = (e: React.MouseEvent) => {
    if (location.pathname === "/city") {
      e.preventDefault();
      cityNav?.resetHome();
    }
  };

  const onWorkNavClick = (e: React.MouseEvent) => {
    if (location.pathname === "/work") {
      e.preventDefault();
      workNav?.resetToCurrentJob();
    }
  };

  const onHomeNavClick = (e: React.MouseEvent) => {
    if (location.pathname === "/home") {
      e.preventDefault();
      homeNav?.resetHome();
    }
  };

  return (
    <div className="app-shell">
      {p && (
        <header className="app-header">
          <div className="money-bar">
            <span className="money-bar-player">
              <span className="money-bar-name">{p.displayName}</span>
              <span className="money-bar-city">
                {cityDisplayName(p.cityId)} · {(p.isResident ?? false) ? "Житель" : "Гость"}
              </span>
            </span>
            {headerTitle && <span className="money-bar-title">{headerTitle}</span>}
            <span className="money-bar-wallet">
              <span className="money-bar-wallet-label">Баланс</span>
              <span className="money-bar-rubles rub-amount">{formatRub(p.rubles)}</span>
            </span>
          </div>
        </header>
      )}
      <main className="app-main">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <nav className="bottom-nav bottom-nav-safe" aria-label="Основное меню">
        <div className="bottom-nav-inner">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              aria-label={label}
              onClick={
                to === "/city"
                  ? onCityNavClick
                  : to === "/work"
                    ? onWorkNavClick
                    : to === "/home"
                      ? onHomeNavClick
                      : undefined
              }
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-item-icon">{icon}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

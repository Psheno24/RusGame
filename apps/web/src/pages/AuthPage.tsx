import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkServerHealth } from "../api";
import { useApp } from "../context";
import { formatRub } from "../formatRub.js";

function connectionHint(): string | null {
  const host = window.location.hostname;
  if (host.startsWith("www.") || host === "rupkgame.ru") {
    return "Откройте игру по адресу https://game.rupkgame.ru (без www).";
  }
  return null;
}

export function AuthPage() {
  const { login, register } = useApp();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [hostWarning, setHostWarning] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hint = connectionHint();
    if (hint) {
      setHostWarning(hint);
      setServerOk(false);
      return;
    }
    void checkServerHealth().then(setServerOk);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(loginName, password);
      else await register(loginName, password);
      nav("/city", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <section className="auth-card card">
        <p className="auth-kicker">Urban life RPG</p>
        <h1>Россия — жизнь</h1>
        <p className="subtitle">Выбери город, работай, покупай жильё и строй свою историю на карте страны.</p>
        <div className="tabs-inline">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Вход
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Регистрация
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <input
            className="input"
            placeholder="Логин"
            autoComplete="username"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Пароль (мин. 6)"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {hostWarning && <p className="auth-error">{hostWarning}</p>}
          {serverOk === false && !hostWarning && (
            <p className="auth-error">
              Сервер недоступен. Проверьте интернет или отключите блокировщик рекламы для этого сайта.
            </p>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy || serverOk === false}>
            {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
        <p className="auth-footnote">Старт в Омске · {formatRub(5000)} · сессия запоминается на телефоне</p>
      </section>
    </div>
  );
}

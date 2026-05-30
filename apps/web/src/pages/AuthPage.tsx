import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context";

export function AuthPage() {
  const { login, register } = useApp();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      <h1>Россия — жизнь</h1>
      <p className="subtitle">Выбери город, работай, переезжай. Минимальная версия — уже можно играть.</p>
      <div className="tabs-inline">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
          Вход
        </button>
        <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
          Регистрация
        </button>
      </div>
      <form onSubmit={submit}>
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
        {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
      <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 20 }}>
        Старт в Омске · 5 000 ₽ · сессия запоминается на телефоне
      </p>
    </div>
  );
}

import { Link } from "react-router-dom";
import { formatRub } from "../formatRub.js";
import { useCallback, useEffect, useState } from "react";
import { useNotice } from "../noticeContext";
import {
  fetchTestAccounts,
  resetTestAccount,
  setTestAccountBalance,
  type TestAdminAccount,
} from "../api";
import { useApp } from "../context";
import { ConfirmDialog } from "./ConfirmDialog";

type Action = "reset" | "balance";
type Step = "idle" | "pick" | "confirm" | "balance";

export function TestAdminPanel() {
  const { user, setUser } = useApp();
  const { showNotice } = useNotice();
  const [step, setStep] = useState<Step>("idle");
  const [action, setAction] = useState<Action>("reset");
  const [accounts, setAccounts] = useState<TestAdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TestAdminAccount | null>(null);
  const [balanceInput, setBalanceInput] = useState("");

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTestAccounts();
      setAccounts(data.accounts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить список");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === "pick") void loadAccounts();
  }, [step, loadAccounts]);

  const closeAll = () => {
    setStep("idle");
    setSelected(null);
    setBalanceInput("");
    setError(null);
  };

  const openPick = (nextAction: Action) => {
    setAction(nextAction);
    setSelected(null);
    setBalanceInput("");
    setError(null);
    setStep("pick");
  };

  const onReset = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await resetTestAccount(selected.login);
      showNotice(`Аккаунт «${selected.login}» обнулён`, "success");
      closeAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка обнуления");
    } finally {
      setBusy(false);
    }
  };

  const onSetBalance = async () => {
    if (!selected) return;
    const rubles = Number(balanceInput.replace(/\s/g, ""));
    if (!Number.isFinite(rubles) || !Number.isInteger(rubles) || rubles < 0) {
      setError("Введите целое число от 0");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await setTestAccountBalance(selected.login, rubles);
      showNotice(`Баланс «${selected.login}»: ${formatRub(result.rubles)}`, "success");
      if (user?.player && selected.login.toLowerCase() === user.login.toLowerCase()) {
        setUser((prev) =>
          prev ? { ...prev, player: { ...prev.player, rubles: result.rubles } } : prev,
        );
      }
      closeAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка изменения баланса");
    } finally {
      setBusy(false);
    }
  };

  const pickTitle = action === "reset" ? "Выберите аккаунт" : "Кому изменить баланс";
  const pickHint =
    action === "reset"
      ? "Прогресс, имущество и работа будут сброшены."
      : "Укажите новый баланс на следующем шаге.";

  return (
    <>
      <div className="card test-admin-panel">
        <h2>Админ-панель</h2>
        <p className="test-admin-hint">
          Доступно только тестовому аккаунту: сброс прогресса или изменение баланса любого игрока.
        </p>
        <div className="test-admin-actions">
          <Link className="btn btn-secondary" to="/admin/car-3d">
            Номера авто
          </Link>
          <button className="btn btn-danger" type="button" onClick={() => openPick("reset")}>
            Обнулить аккаунт
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => openPick("balance")}>
            Изменить баланс
          </button>
        </div>
      </div>

      {step === "pick" && (
        <div className="confirm-backdrop" role="presentation" onClick={closeAll}>
          <div
            className="confirm-dialog test-admin-dialog"
            role="dialog"
            aria-labelledby="test-admin-pick-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="test-admin-pick-title" className="confirm-dialog-title">
              {pickTitle}
            </h2>
            <p className="confirm-dialog-text">{pickHint}</p>
            {loading ? (
              <p className="test-admin-hint">Загрузка…</p>
            ) : error ? (
              <p className="test-admin-error" role="alert">
                {error}
              </p>
            ) : (
              <ul className="test-admin-account-list">
                {accounts.map((account) => (
                  <li key={account.userId}>
                    <button
                      type="button"
                      className="test-admin-account-btn"
                      onClick={() => {
                        setSelected(account);
                        setBalanceInput(String(account.rubles));
                        setError(null);
                        setStep(action === "reset" ? "confirm" : "balance");
                      }}
                    >
                      <span className="test-admin-account-login">{account.login}</span>
                      <span className="test-admin-account-meta">
                        {account.displayName} · {formatRub(account.rubles)}
                        {account.isTest ? " · тест" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="confirm-dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={closeAll}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "confirm" && selected && (
        <ConfirmDialog
          title="Обнулить аккаунт?"
          text={`«${selected.login}» (${selected.displayName}) вернётся в Омск с начальными деньгами, без работы и имущества.`}
          confirmLabel={busy ? "Сброс…" : "Обнулить"}
          confirmClassName="btn-danger"
          onCancel={() => {
            setSelected(null);
            setStep("pick");
          }}
          onConfirm={() => {
            if (!busy) void onReset();
          }}
        />
      )}

      {step === "balance" && selected && (
        <div className="confirm-backdrop" role="presentation" onClick={closeAll}>
          <div
            className="confirm-dialog test-admin-dialog"
            role="dialog"
            aria-labelledby="test-admin-balance-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="test-admin-balance-title" className="confirm-dialog-title">
              Новый баланс
            </h2>
            <p className="confirm-dialog-text">
              «{selected.login}» — сейчас {formatRub(selected.rubles)}
            </p>
            <label className="test-admin-balance-field">
              <span className="test-admin-balance-label">Сумма, ₽</span>
              <input
                className="test-admin-balance-input"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                disabled={busy}
              />
            </label>
            {error ? (
              <p className="test-admin-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="confirm-dialog-actions">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setSelected(null);
                  setStep("pick");
                }}
              >
                Назад
              </button>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void onSetBalance()}>
                {busy ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

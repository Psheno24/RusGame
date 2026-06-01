import { useCallback, useEffect, useState } from "react";
import { useNotice } from "../noticeContext";
import {
  fetchTestAccounts,
  resetTestAccount,
  type TestAdminAccount,
} from "../api";
import { ConfirmDialog } from "./ConfirmDialog";

type Step = "idle" | "pick" | "confirm";

export function TestAdminPanel() {
  const { showNotice } = useNotice();
  const [step, setStep] = useState<Step>("idle");
  const [accounts, setAccounts] = useState<TestAdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TestAdminAccount | null>(null);

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
    setError(null);
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

  return (
    <>
      <div className="card test-admin-panel">
        <h2>Админ-панель</h2>
        <p className="test-admin-hint">Тестовый аккаунт: сброс прогресса любого игрока до стартового состояния.</p>
        <button className="btn btn-danger" type="button" onClick={() => setStep("pick")}>
          Обнулить аккаунт
        </button>
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
              Выберите аккаунт
            </h2>
            <p className="confirm-dialog-text">Прогресс, имущество и работа будут сброшены.</p>
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
                        setStep("confirm");
                      }}
                    >
                      <span className="test-admin-account-login">{account.login}</span>
                      <span className="test-admin-account-meta">
                        {account.displayName} · {account.rubles.toLocaleString("ru-RU")} ₽
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
    </>
  );
}

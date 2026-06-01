import { useEffect, useState } from "react";
import { buyPoliceLicense, fetchPoliceLicenses, type User } from "../api";
import type { NavBackHandler } from "../navBack";
import { ConfirmDialog } from "./ConfirmDialog";

type LicenseRow = {
  category: string;
  title: string;
  subtitle: string;
  priceRub: number;
};

type PoliceNav = "hub" | "licenses" | "fines";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitPlace: () => void;
};

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function PoliceLicenseShop({ user, setUser, onToast, registerBack, onExitPlace }: Props) {
  const [nav, setNav] = useState<PoliceNav>("hub");
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [pending, setPending] = useState<LicenseRow | null>(null);
  const [busy, setBusy] = useState(false);
  const owned = new Set(user.player.driverLicenseCategories ?? []);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (nav !== "hub") {
        setNav("hub");
        return true;
      }
      onExitPlace();
      return true;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [nav, registerBack, onExitPlace]);

  useEffect(() => {
    if (nav === "licenses") {
      fetchPoliceLicenses()
        .then((r) => setLicenses(r.licenses))
        .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
    }
  }, [nav, onToast]);

  const onConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await buyPoliceLicense(pending.category);
      setUser(r.user);
      onToast(`Права категории ${pending.category} получены`);
      setPending(null);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {pending && (
        <ConfirmDialog
          title="Получить права?"
          text={`Оформить ${pending.title} (${pending.subtitle}) за ${rub(pending.priceRub)}?`}
          confirmLabel="Оплатить"
          confirmClassName="btn-primary"
          onCancel={() => setPending(null)}
          onConfirm={() => void onConfirm()}
        />
      )}

      {nav === "hub" && (
        <div className="city-grid shop-categories phone-hub police-hub">
          <button type="button" className="city-grid-btn" onClick={() => setNav("licenses")}>
            <span className="city-grid-title">Водительское удостоверение</span>
            <span className="city-grid-hint">Категории A, B, C, D, BE</span>
          </button>
          <button type="button" className="city-grid-btn" onClick={() => setNav("fines")}>
            <span className="city-grid-title">Штрафы</span>
            <span className="city-grid-hint">Скоро</span>
          </button>
        </div>
      )}

      {nav === "licenses" && (
        <div className="police-licenses">
          <p className="place-detail-lead">
            Оформление прав для покупки и управления транспортом нужной категории.
          </p>
          <p className="shop-balance">На счёте: {rub(user.player.rubles)}</p>
          <ul className="phone-list police-license-list">
            {licenses.map((lic) => {
              const has = owned.has(lic.category);
              return (
                <li key={lic.category}>
                  <div className="police-license-row">
                    <div className="police-license-info">
                      <span className="phone-list-name">{lic.title}</span>
                      <span className="phone-list-price">{lic.subtitle}</span>
                      <span className="city-grid-hint">{rub(lic.priceRub)}</span>
                    </div>
                    {has ? (
                      <span className="phone-list-badge">куплено</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary police-license-btn"
                        disabled={busy || user.player.rubles < lic.priceRub}
                        onClick={() => setPending(lic)}
                      >
                        Получить
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {nav === "fines" && (
        <div className="card">
          <p className="place-detail-lead">Оплата и история штрафов появятся в следующих обновлениях.</p>
        </div>
      )}
    </>
  );
}

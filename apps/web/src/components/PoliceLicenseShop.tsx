import { formatRub } from "../formatRub.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { buyPoliceLicense, fetchPoliceLicenses, type User } from "../api";
import { useToastRef } from "../hooks/useToastRef";
import type { NavBackHandler } from "../navBack";
import { PLATES_MENU_TITLE, PLATES_POLICE_MENU_HINT } from "../plateCopy";
import { ConfirmDialog } from "./ConfirmDialog";
import { PlateShopSection } from "./PlateShopSection";
import { testOnlyGridHint, testOnlyLocked } from "../testOnlyUi";
import { POLICE_ICONS } from "../gridIcons";
import { CityGridButton } from "./ui/CityGridButton";
import type { PlaceNavState } from "../placeNav";

type LicenseRow = {
  category: string;
  title: string;
  subtitle: string;
  priceRub: number;
};

type PoliceNav = "hub" | "licenses" | "plates" | "fines";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: PlaceNavState) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitPlace: () => void;
};

function rub(n: number) {
  return `${formatRub(n)}`;
}

export function PoliceLicenseShop({ user, setUser, onToast, onNavChange, registerBack, onExitPlace }: Props) {
  const isTest = Boolean(user.isTest);
  const onToastRef = useToastRef(onToast);
  const [nav, setNav] = useState<PoliceNav>("hub");
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [pending, setPending] = useState<LicenseRow | null>(null);
  const [busy, setBusy] = useState(false);
  const platesBackRef = useRef<NavBackHandler | null>(null);
  const [platesNav, setPlatesNav] = useState<PlaceNavState>({
    inSub: false,
    title: PLATES_MENU_TITLE,
    backLabel: "Полиция",
  });
  const owned = new Set(user.player.driverLicenseCategories ?? []);

  const registerPlatesBack = useCallback((handler: NavBackHandler | null) => {
    platesBackRef.current = handler;
  }, []);

  useEffect(() => {
    if (nav === "hub") {
      onNavChange({ inSub: false, title: "Полиция", backLabel: "Другие места" });
    } else if (nav === "licenses") {
      onNavChange({ inSub: true, title: "Водительские права", backLabel: "Полиция" });
    } else if (nav === "fines") {
      onNavChange({ inSub: true, title: "Штрафы", backLabel: "Полиция" });
    } else if (nav === "plates") {
      onNavChange({
        inSub: true,
        title: platesNav.title,
        backLabel: platesNav.backLabel,
      });
    }
  }, [nav, platesNav, onNavChange]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (nav === "plates") {
        if (platesBackRef.current?.()) return true;
        setNav("hub");
        return true;
      }
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
        .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
    }
  }, [nav]);

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

  if (nav === "plates") {
    return (
      <PlateShopSection
        user={user}
        setUser={setUser}
        onToast={onToast}
        onNavChange={setPlatesNav}
        registerBack={registerPlatesBack}
      />
    );
  }

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
          <CityGridButton title="Водительские права" icon={POLICE_ICONS.licenses} onClick={() => setNav("licenses")} />
          <CityGridButton
            title={PLATES_MENU_TITLE}
            icon={POLICE_ICONS.plates}
            hint={PLATES_POLICE_MENU_HINT}
            onClick={() => setNav("plates")}
          />
          <CityGridButton
            title="Штрафы"
            icon={POLICE_ICONS.fines}
            hint={testOnlyGridHint(isTest, true)}
            disabled={testOnlyLocked(isTest, true)}
            onClick={() => {
              if (isTest) setNav("fines");
            }}
          />
        </div>
      )}

      {nav === "licenses" && (
        <div className="police-licenses">
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
        <p className="place-detail-lead">Оплата и история штрафов появятся в следующих обновлениях.</p>
      )}
    </>
  );
}

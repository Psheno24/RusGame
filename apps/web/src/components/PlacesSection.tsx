import { useEffect, useState } from "react";
import { performAction, type User } from "../api";
import type { NavBackHandler } from "../navBack";
import { CITY_PLACES, type PlaceId } from "../placesData";
import { CarRepairPlace } from "./CarRepairPlace";
import { CityGridButton } from "./ui/CityGridButton";
import { PoliceLicenseShop } from "./PoliceLicenseShop";

type Props = {
  placeId: PlaceId | null;
  onPlace: (id: PlaceId | null) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
};

export function PlacesSection({
  placeId,
  onPlace,
  registerBack,
  user,
  setUser,
  onToast,
}: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!placeId || placeId === "police" || placeId === "car_repair") {
      registerBack(null);
      return;
    }
    const handler: NavBackHandler = () => {
      onPlace(null);
      return true;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [placeId, onPlace, registerBack]);

  if (placeId) {
    const place = CITY_PLACES.find((p) => p.id === placeId)!;

    if (placeId === "flea_market") {
      return <p className="shop-stub">Скоро</p>;
    }

    if (placeId === "police") {
      return (
        <div className="place-detail">
          <PoliceLicenseShop
            user={user}
            setUser={setUser}
            onToast={onToast}
            registerBack={registerBack}
            onExitPlace={() => onPlace(null)}
          />
        </div>
      );
    }

    if (placeId === "car_repair") {
      return (
        <div className="place-detail">
          <CarRepairPlace
            user={user}
            setUser={setUser}
            onToast={onToast}
            registerBack={registerBack}
            onExitPlace={() => onPlace(null)}
          />
        </div>
      );
    }

    if (placeId === "cinema") {
      const rubles = user.player.rubles;
      return (
        <div className="place-detail">
          {place.hint ? <p className="place-detail-lead">{place.hint}</p> : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              if (rubles < 500) {
                onToast("Не хватает денег", true);
                return;
              }
              setBusy(true);
              performAction("cinema")
                .then((r) => {
                  setUser(r.user);
                  onToast(r.message);
                })
                .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "…" : "Купить билет"}
          </button>
        </div>
      );
    }

    return <p className="shop-stub">Скоро</p>;
  }

  return (
    <div className="city-grid places-grid">
      {CITY_PLACES.map((p) => (
        <CityGridButton key={p.id} title={p.title} onClick={() => onPlace(p.id)} />
      ))}
    </div>
  );
}

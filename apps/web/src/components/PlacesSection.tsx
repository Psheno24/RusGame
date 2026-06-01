import { useEffect, useState } from "react";
import { performAction, type User } from "../api";
import type { NavBackHandler } from "../navBack";
import { CITY_PLACES, type PlaceId } from "../placesData";

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
    if (!placeId) {
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
      return (
        <div className="place-detail">
          <p className="place-detail-lead">{place.hint}</p>
          <p className="shop-stub">
            Лоты с ценами и городом, где лежит товар, появятся в следующем обновлении. Пока можно
            заглянуть в магазин или недвижимость.
          </p>
        </div>
      );
    }

    if (placeId === "cinema") {
      const rubles = user.player.rubles;
      return (
        <div className="place-detail">
          <p className="place-detail-lead">{place.hint}</p>
          <p>Билет в кино: 500 ₽ · +22 настроение</p>
          <p className="shop-balance">На счёте: {rubles.toLocaleString("ru-RU")} ₽</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || rubles < 500}
            onClick={() => {
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
          {rubles < 500 && <p className="product-block">Не хватает денег</p>}
        </div>
      );
    }

    return (
      <div className="place-detail">
        <p className="place-detail-lead">{place.hint}</p>
        <p className="shop-stub">Содержимое «{place.title}» появится в следующих обновлениях.</p>
      </div>
    );
  }

  return (
    <div className="city-grid places-grid">
      {CITY_PLACES.map((p) => (
        <button key={p.id} type="button" className="city-grid-btn" onClick={() => onPlace(p.id)}>
          <span className="city-grid-title">{p.title}</span>
          <span className="city-grid-hint">{p.hint}</span>
        </button>
      ))}
    </div>
  );
}

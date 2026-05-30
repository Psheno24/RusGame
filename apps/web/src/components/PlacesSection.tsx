import { useEffect } from "react";
import type { NavBackHandler } from "../navBack";
import { CITY_PLACES, type PlaceId } from "../placesData";

type Props = {
  placeId: PlaceId | null;
  onPlace: (id: PlaceId | null) => void;
  registerBack: (handler: NavBackHandler | null) => void;
};

export function PlacesSection({ placeId, onPlace, registerBack }: Props) {
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

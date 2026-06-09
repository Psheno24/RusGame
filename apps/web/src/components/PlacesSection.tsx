import { useEffect, useState } from "react";
import type { User } from "../api";
import type { NavBackHandler } from "../navBack";
import { CITY_PLACES, type PlaceId } from "../placesData";
import { testOnlyGridHint, testOnlyLocked } from "../testOnlyUi";
import { CarRepairPlace } from "./CarRepairPlace";
import { GasStationPlace } from "./GasStationPlace";
import { CityGridButton } from "./ui/CityGridButton";
import { PoliceLicenseShop } from "./PoliceLicenseShop";
import { EducationPlace } from "./EducationPlace";

import type { PlaceNavState } from "../placeNav";

type Props = {
  placeId: PlaceId | null;
  onPlace: (id: PlaceId | null) => void;
  onNavChange: (state: PlaceNavState) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
};

const STUB_PLACE_IDS = new Set<PlaceId>([
  "flea_market",
  "phone_repair",
  "ambulance",
  "court",
]);

export function PlacesSection({
  placeId,
  onPlace,
  onNavChange,
  registerBack,
  user,
  setUser,
  onToast,
}: Props) {
  const isTest = Boolean(user.isTest);

  useEffect(() => {
    if (
      !placeId ||
      placeId === "police" ||
      placeId === "car_repair" ||
      placeId === "gas_station" ||
      placeId === "education"
    ) {
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
    if (placeId === "police") {
      return (
        <div className="place-detail">
          <PoliceLicenseShop
            user={user}
            setUser={setUser}
            onToast={onToast}
            onNavChange={onNavChange}
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
            onNavChange={onNavChange}
            registerBack={registerBack}
            onExitPlace={() => onPlace(null)}
          />
        </div>
      );
    }

    if (placeId === "education") {
      return (
        <div className="place-detail">
          <EducationPlace
            user={user}
            setUser={setUser}
            onToast={onToast}
            onNavChange={onNavChange}
            registerBack={registerBack}
            onExitPlace={() => onPlace(null)}
          />
        </div>
      );
    }

    if (placeId === "gas_station") {
      return (
        <div className="place-detail">
          <GasStationPlace
            user={user}
            setUser={setUser}
            onToast={onToast}
            onNavChange={onNavChange}
            registerBack={registerBack}
            onExitPlace={() => onPlace(null)}
          />
        </div>
      );
    }

    if (STUB_PLACE_IDS.has(placeId)) {
      return <p className="shop-stub">Скоро</p>;
    }

    return <p className="shop-stub">Скоро</p>;
  }

  return (
    <div className="city-grid places-grid">
      {CITY_PLACES.map((p) => {
        const locked = testOnlyLocked(isTest, p.testOnly);
        return (
          <CityGridButton
            key={p.id}
            title={p.title}
            hint={testOnlyGridHint(isTest, p.testOnly, p.hint)}
            disabled={locked}
            onClick={() => onPlace(p.id)}
          />
        );
      })}
    </div>
  );
}

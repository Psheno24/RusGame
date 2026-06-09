import { useEffect, useState } from "react";
import type { NavBackHandler } from "../navBack";
import type { User } from "../api";
import { CareerEducationPanel } from "./CareerEducationPanel";
import { TestOnlyNotice } from "./TestOnlyNotice";
import { testOnlyGridHint, testOnlyLocked } from "../testOnlyUi";
import { CityGridButton } from "./ui/CityGridButton";

type EduNav = "hub" | "secondary_edu" | "higher_edu";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitPlace: () => void;
};

export function EducationPlace({ user, setUser, onToast, registerBack, onExitPlace }: Props) {
  const [nav, setNav] = useState<EduNav>("hub");
  const isTest = Boolean(user.isTest);

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

  if (nav === "secondary_edu" || nav === "higher_edu") {
    return (
      <CareerEducationPanel
        mode={nav}
        user={user}
        setUser={setUser}
        onToast={onToast}
        onBack={() => setNav("hub")}
        backLabel="Образование"
        testOnly
      />
    );
  }

  return (
    <div className="place-detail education-place">
      {isTest ? <TestOnlyNotice /> : null}
      <div className="city-grid shop-categories education-hub">
        <CityGridButton
          title="Среднее образование"
          hint={testOnlyGridHint(isTest, true)}
          disabled={testOnlyLocked(isTest, true)}
          onClick={() => setNav("secondary_edu")}
        />
        <CityGridButton
          title="Высшее образование"
          hint={testOnlyGridHint(isTest, true)}
          disabled={testOnlyLocked(isTest, true)}
          onClick={() => setNav("higher_edu")}
        />
      </div>
    </div>
  );
}

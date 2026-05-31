import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

const CityNavContext = createContext<{
  registerReset: (fn: (() => void) | null) => void;
  resetHome: () => void;
} | null>(null);

export function CityNavProvider({ children }: { children: ReactNode }) {
  const resetRef = useRef<(() => void) | null>(null);
  const registerReset = useCallback((fn: (() => void) | null) => {
    resetRef.current = fn;
  }, []);
  const resetHome = useCallback(() => {
    resetRef.current?.();
  }, []);
  return (
    <CityNavContext.Provider value={{ registerReset, resetHome }}>
      {children}
    </CityNavContext.Provider>
  );
}

export function useCityNav() {
  return useContext(CityNavContext);
}

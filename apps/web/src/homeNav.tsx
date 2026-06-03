import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

const HomeNavContext = createContext<{
  registerReset: (fn: (() => void) | null) => void;
  resetHome: () => void;
} | null>(null);

export function HomeNavProvider({ children }: { children: ReactNode }) {
  const resetRef = useRef<(() => void) | null>(null);
  const registerReset = useCallback((fn: (() => void) | null) => {
    resetRef.current = fn;
  }, []);
  const resetHome = useCallback(() => {
    resetRef.current?.();
  }, []);
  return (
    <HomeNavContext.Provider value={{ registerReset, resetHome }}>
      {children}
    </HomeNavContext.Provider>
  );
}

export function useHomeNav() {
  return useContext(HomeNavContext);
}

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

const WorkNavContext = createContext<{
  registerReset: (fn: (() => void) | null) => void;
  resetToCurrentJob: () => void;
} | null>(null);

export function WorkNavProvider({ children }: { children: ReactNode }) {
  const resetRef = useRef<(() => void) | null>(null);
  const registerReset = useCallback((fn: (() => void) | null) => {
    resetRef.current = fn;
  }, []);
  const resetToCurrentJob = useCallback(() => {
    resetRef.current?.();
  }, []);
  return (
    <WorkNavContext.Provider value={{ registerReset, resetToCurrentJob }}>
      {children}
    </WorkNavContext.Provider>
  );
}

export function useWorkNav() {
  return useContext(WorkNavContext);
}

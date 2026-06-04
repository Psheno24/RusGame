import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

type TabId = "home" | "city" | "work";

const TabNavContext = createContext<{
  registerReset: (tab: TabId, fn: (() => void) | null) => void;
  reset: (tab: TabId) => void;
} | null>(null);

export function TabNavProvider({ children }: { children: ReactNode }) {
  const refs = useRef<Record<TabId, (() => void) | null>>({
    home: null,
    city: null,
    work: null,
  });

  const registerReset = useCallback((tab: TabId, fn: (() => void) | null) => {
    refs.current[tab] = fn;
  }, []);

  const reset = useCallback((tab: TabId) => {
    refs.current[tab]?.();
  }, []);

  return (
    <TabNavContext.Provider value={{ registerReset, reset }}>{children}</TabNavContext.Provider>
  );
}

function useTabNavSlot(tab: TabId) {
  const ctx = useContext(TabNavContext);
  const registerReset = useCallback(
    (fn: (() => void) | null) => {
      ctx?.registerReset(tab, fn);
    },
    [ctx, tab],
  );
  const reset = useCallback(() => {
    ctx?.reset(tab);
  }, [ctx, tab]);
  return { registerReset, reset };
}

export function useHomeNav() {
  const { registerReset, reset } = useTabNavSlot("home");
  return { registerReset, resetHome: reset };
}

export function useCityNav() {
  const { registerReset, reset } = useTabNavSlot("city");
  return { registerReset, resetHome: reset };
}

export function useWorkNav() {
  const { registerReset, reset } = useTabNavSlot("work");
  return { registerReset, resetToCurrentJob: reset };
}

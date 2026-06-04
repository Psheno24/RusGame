import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  register as apiRegister,
  setAccessToken,
  type User,
} from "./api";

type AppContextValue = {
  user: User | null;
  loading: boolean;
  setUser: Dispatch<SetStateAction<User | null>>;
  login: (l: string, p: string) => Promise<void>;
  register: (l: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const fromRefresh = await refreshSession();
    if (fromRefresh) {
      setUser(fromRefresh);
      return;
    }
    try {
      setUser(await fetchMe());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const login = async (l: string, p: string) => {
    const u = await apiLogin(l, p);
    setUser(u);
  };

  const register = async (l: string, p: string) => {
    const u = await apiRegister(l, p);
    setUser(u);
  };

  const logout = async () => {
    await apiLogout();
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AppContext.Provider value={{ user, loading, setUser, login, register, logout, reload }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

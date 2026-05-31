import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { DismissibleNotice } from "./components/DismissibleNotice";
import { NOTICE_TOAST_AUTO_DISMISS_MS, type NoticeTone } from "./noticeConfig";

type NoticeState = {
  message: string;
  tone: NoticeTone;
  id: number;
};

const NoticeContext = createContext<{
  showNotice: (message: string, tone?: NoticeTone) => void;
} | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<NoticeState | null>(null);

  const showNotice = useCallback((message: string, tone: NoticeTone = "info") => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  return (
    <NoticeContext.Provider value={{ showNotice }}>
      {children}
      {toast && (
        <DismissibleNotice
          variant="toast"
          tone={toast.tone}
          message={toast.message}
          resetKey={toast.id}
          onDismiss={() => setToast(null)}
          autoDismissMs={NOTICE_TOAST_AUTO_DISMISS_MS}
        />
      )}
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const ctx = useContext(NoticeContext);
  if (!ctx) throw new Error("useNotice must be used within NoticeProvider");
  return ctx;
}

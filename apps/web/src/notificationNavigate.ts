import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function useNotificationNavigate() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === "notification-navigate" && typeof data.url === "string") {
        navigate(data.url);
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);
}

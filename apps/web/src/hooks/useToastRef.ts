import { useRef } from "react";

export type ToastFn = (msg: string, isErr?: boolean) => void;

/** Стабильная ссылка на onToast — не триггерить useEffect при каждом рендере родителя. */
export function useToastRef(onToast: ToastFn) {
  const ref = useRef(onToast);
  ref.current = onToast;
  return ref;
}

import { useCallback, useRef } from "react";

/** true = один шаг назад обработан внутри текущего раздела */
export type NavBackHandler = () => boolean;

/**
 * Один активный обработчик «Назад» на уровень UI.
 * Дочерний компонент регистрируется в useEffect и снимается при размонтировании —
 * без счётчиков, без ложных срабатываний после повторного входа.
 */
export function useNavBackSlot() {
  const handlerRef = useRef<NavBackHandler | null>(null);

  const register = useCallback((handler: NavBackHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const tryBack = useCallback((): boolean => handlerRef.current?.() ?? false, []);

  return { register, tryBack };
}

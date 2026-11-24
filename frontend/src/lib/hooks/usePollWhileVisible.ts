"use client";

import { useEffect, useRef } from "react";

function isPageVisible(): boolean {
  return document.visibilityState === "visible";
}

/**
 * Vuelve a ejecutar `onPoll` cada `intervalMs` mientras `enabled` sea verdadero y la pestaña
 * esté visible. Con la pestaña oculta no consulta; al volver a la pestaña (o a la app),
 * consulta en el momento y retoma el intervalo. Con `enabled` en falso se corta del todo.
 */
export function usePollWhileVisible(
  onPoll: () => void,
  intervalMs: number,
  enabled: boolean,
): void {
  const onPollRef = useRef(onPoll);

  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  useEffect(() => {
    if (!enabled) return;

    let timerId: ReturnType<typeof setInterval> | null = null;

    function stop() {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    function start() {
      stop();
      timerId = setInterval(() => onPollRef.current(), intervalMs);
    }

    function handleVisibilityChange() {
      if (isPageVisible()) {
        onPollRef.current();
        start();
      } else {
        stop();
      }
    }

    if (isPageVisible()) start();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const FAB_HINT_STORAGE_KEY = "callejeros_fab_usado";
const FAB_IDLE_DELAY_MS = 2500;
const FAB_HINT_FIRST_DELAY_MS = 2000;
const FAB_HINT_VISIBLE_MS = 3000;
const FAB_HINT_INTERVAL_MS = 30000;

interface FabRouteConfig {
  href: string;
  hasHint: boolean;
  ariaLabel: string;
}

export function getFabConfigForPath(pathname: string): FabRouteConfig | null {
  const cleanPath = pathname.split("#")[0]?.replace(/\/+$/, "") || "/";

  if (cleanPath === "/" || cleanPath === "/alertas") {
    return {
      href: "/alertas/reportar",
      hasHint: true,
      ariaLabel: "Alerta Callejeros - Reportar mascota perdida o en peligro",
    };
  }

  if (cleanPath === "/adopciones" || cleanPath === "/quienes-somos") {
    return {
      href: "/alertas",
      hasHint: false,
      ariaLabel: "Alerta Callejeros",
    };
  }

  return null;
}

export interface AlertFabProps {
  isHidden?: boolean;
}

export function AlertFab({ isHidden = false }: AlertFabProps) {
  const pathname = usePathname() || "/";
  const config = getFabConfigForPath(pathname);

  const [isActive, setIsActive] = useState(false);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintActiveRef = useRef(false);
  const isHiddenRef = useRef(isHidden);

  useEffect(() => {
    isHiddenRef.current = isHidden;
  }, [isHidden]);

  // Transparencia en reposo (opacity-25) vs. actividad (scroll / touchstart -> opacity-90 por 2.5 s)
  useEffect(() => {
    if (!config) return;

    function triggerActivity() {
      if (hintActiveRef.current) return;
      setIsActive(true);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        setIsActive(false);
      }, FAB_IDLE_DELAY_MS);
    }

    const initialKickTimer = setTimeout(triggerActivity, 0);
    window.addEventListener("scroll", triggerActivity, { passive: true });
    window.addEventListener("touchstart", triggerActivity, { passive: true });

    return () => {
      clearTimeout(initialKickTimer);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      window.removeEventListener("scroll", triggerActivity);
      window.removeEventListener("touchstart", triggerActivity);
    };
  }, [config, pathname]);

  // En celular, en Inicio y Alerta Callejeros, despliega el texto "Publicar Alerta Callejero"
  // durante 3 s (a los 2 s de entrar y después cada 30 s) hasta que el usuario lo toca una vez.
  useEffect(() => {
    if (!config?.hasHint) return;

    const resetTimer = setTimeout(() => {
      hintActiveRef.current = false;
      setIsHintVisible(false);
    }, 0);

    let fabUsed = false;
    try {
      fabUsed = localStorage.getItem(FAB_HINT_STORAGE_KEY) === "1";
    } catch {
      fabUsed = false;
    }

    if (typeof window.matchMedia === "function") {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      setTimeout(() => setPrefersReducedMotion(reduced), 0);
    }

    if (fabUsed) {
      return () => {
        clearTimeout(resetTimer);
      };
    }

    let hideHintTimer: ReturnType<typeof setTimeout> | null = null;

    function showFabHint() {
      if (document.hidden || isHiddenRef.current) return;
      if (typeof window.matchMedia === "function") {
        const isMobile = window.matchMedia("(max-width: 639px)").matches;
        if (!isMobile) return;
      }

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      hintActiveRef.current = true;
      setIsHintVisible(true);

      if (hideHintTimer) {
        clearTimeout(hideHintTimer);
      }
      hideHintTimer = setTimeout(() => {
        hintActiveRef.current = false;
        setIsHintVisible(false);
        setIsActive(false);
      }, FAB_HINT_VISIBLE_MS);
    }

    const firstTimer = setTimeout(showFabHint, FAB_HINT_FIRST_DELAY_MS);
    const intervalTimer = setInterval(showFabHint, FAB_HINT_INTERVAL_MS);

    return () => {
      clearTimeout(resetTimer);
      clearTimeout(firstTimer);
      clearInterval(intervalTimer);
      if (hideHintTimer) {
        clearTimeout(hideHintTimer);
      }
      hintActiveRef.current = false;
    };
  }, [config?.hasHint, pathname]);

  if (!config) {
    return null;
  }

  function handleFabClick() {
    try {
      localStorage.setItem(FAB_HINT_STORAGE_KEY, "1");
    } catch {
      // Sin almacenamiento disponible: no bloquea la navegación
    }
    hintActiveRef.current = false;
    setIsHintVisible(false);
  }

  const stateOpacityClasses = isHintVisible
    ? "bg-red-600 opacity-100"
    : isActive
      ? "bg-red-600/90 opacity-90"
      : "bg-red-600/90 opacity-25";

  return (
    <Link
      href={config.href}
      id="fab-alerta"
      onClick={handleFabClick}
      data-fab-hint={config.hasHint ? "Publicar Alerta Callejero" : undefined}
      data-hint-active={isHintVisible ? "1" : undefined}
      aria-label={config.ariaLabel}
      className={`fixed right-6 bottom-6 z-40 flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border border-orange-500/40 px-4 py-3 text-xs font-bold text-white shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-red-600 hover:opacity-100 focus:opacity-100 focus:outline-hidden focus-visible:ring-4 focus-visible:ring-red-400 active:scale-95 sm:text-sm ${stateOpacityClasses} ${
        isHidden ? "hidden" : ""
      }`}
    >
      <svg
        className="h-5 w-5 animate-bounce motion-reduce:animate-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span className="hidden sm:inline">Alerta Callejeros</span>
      {config.hasHint && (
        <span
          aria-hidden="true"
          style={{
            maxWidth: isHintVisible ? "15rem" : "0",
            marginLeft: isHintVisible ? "0" : "-0.5rem",
            transition: prefersReducedMotion
              ? undefined
              : "max-width 0.45s ease, margin-left 0.45s ease",
          }}
          className="fab-hint overflow-hidden whitespace-nowrap sm:hidden"
        >
          Publicar Alerta Callejero
        </span>
      )}
    </Link>
  );
}

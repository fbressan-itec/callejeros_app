"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type MouseEvent, useEffect } from "react";

export const PREVIOUS_PATH_STORAGE_KEY = "callejeros_prev_path";
export const CURRENT_PATH_STORAGE_KEY = "callejeros_current_path";

export interface BackButtonProps {
  fallbackHref?: string;
  label?: string;
  ariaLabel?: string;
  iconOnly?: boolean;
  className?: string;
}

function isAuthPath(pathname: string): boolean {
  return /(^|\/)(login|registro|recuperar)(\.html)?\/?$/.test(pathname);
}

export function recordRouteVisit(pathname: string): void {
  try {
    const current = sessionStorage.getItem(CURRENT_PATH_STORAGE_KEY);
    if (current && current !== pathname) {
      sessionStorage.setItem(PREVIOUS_PATH_STORAGE_KEY, current);
    }
    sessionStorage.setItem(CURRENT_PATH_STORAGE_KEY, pathname);
  } catch {
    // Sin sessionStorage disponible: se usa fallbackHref
  }
}

export function useNavigationHistoryTracker(): void {
  const pathname = usePathname() || "/";

  useEffect(() => {
    recordRouteVisit(pathname);
  }, [pathname]);
}

export function BackButton({
  fallbackHref = "/",
  label = "Volver",
  ariaLabel = "Volver a la pantalla anterior",
  iconOnly = false,
  className,
}: BackButtonProps) {
  const router = useRouter();
  const currentPathname = usePathname() || "/";

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    let previousPath: string | null = null;
    try {
      previousPath = sessionStorage.getItem(PREVIOUS_PATH_STORAGE_KEY);
    } catch {
      previousPath = null;
    }

    const fromAuth =
      previousPath !== null &&
      isAuthPath(previousPath) &&
      !isAuthPath(currentPathname);

    if (previousPath && !fromAuth) {
      event.preventDefault();
      router.back();
    }
  }

  const baseClassName = iconOnly
    ? "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    : "inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:focus-visible:ring-offset-slate-800";

  return (
    <Link
      href={fallbackHref}
      data-back
      onClick={handleClick}
      aria-label={ariaLabel}
      className={className ? `${baseClassName} ${className}` : baseClassName}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      {iconOnly ? null : (
        <span className="hidden text-sm font-semibold sm:inline">{label}</span>
      )}
    </Link>
  );
}

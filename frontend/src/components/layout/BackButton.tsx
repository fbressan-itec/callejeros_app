"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export interface BackButtonProps {
  fallbackHref?: string;
  label?: string;
  ariaLabel?: string;
}

function isAuthPath(pathname: string): boolean {
  return /(^|\/)(login|registro)(\.html)?\/?$/.test(pathname);
}

export function BackButton({
  fallbackHref = "/",
  label = "Volver",
  ariaLabel = "Volver a la pantalla anterior",
}: BackButtonProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    let refUrl: URL | null = null;
    try {
      refUrl = document.referrer ? new URL(document.referrer) : null;
    } catch {
      refUrl = null;
    }

    const sameSite =
      refUrl !== null && refUrl.origin === window.location.origin;
    const fromAuth =
      refUrl !== null &&
      isAuthPath(refUrl.pathname) &&
      !isAuthPath(window.location.pathname);

    if (sameSite && !fromAuth && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <Link
      href={fallbackHref}
      data-back
      onClick={handleClick}
      aria-label={ariaLabel}
      className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
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
      <span className="hidden text-sm font-semibold sm:inline">{label}</span>
    </Link>
  );
}

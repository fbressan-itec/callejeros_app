"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";

export interface NavbarProps {
  isMenuOpen?: boolean;
  onMenuToggle?: () => void;
  isNotificationsOpen?: boolean;
  onNotificationsToggle?: () => void;
  unreadNotificationsCount?: number;
}

export function Navbar({
  isMenuOpen = false,
  onMenuToggle,
  isNotificationsOpen = false,
  onNotificationsToggle,
  unreadNotificationsCount = 0,
}: NavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();

  function handleThemeToggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-xs backdrop-blur-md transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LOGO OFICIAL (Sin texto) */}
        <Link
          href="/"
          className="group flex items-center rounded-xl p-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          aria-label="Ir al inicio - Callejeros Río Cuarto"
        >
          <Image
            src="/images/logo_callejeros.jpg"
            alt="Logo Callejeros Río IV"
            width={140}
            height={48}
            priority
            className="h-11 w-auto rounded-lg object-contain shadow-xs transition-transform duration-200 group-hover:scale-105 group-active:scale-95 sm:h-12"
          />
        </Link>

        {/* CONTROLES SUPERIORES */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* CAMPANITA CON CONTADOR */}
          <button
            type="button"
            id="btn-notifications"
            onClick={onNotificationsToggle}
            className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2.5 text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
            aria-expanded={isNotificationsOpen}
            aria-controls="notifications-slider-panel"
            aria-label="Ver alertas y notificaciones"
            title="Centro de Notificaciones"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadNotificationsCount > 0 && (
              <span
                id="notif-badge-count"
                className="absolute -top-1 -right-1 flex h-5 min-w-[20px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-extrabold text-white shadow-xs ring-2 ring-white dark:ring-slate-900"
              >
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* MODO OSCURO */}
          <button
            type="button"
            id="theme-toggle"
            onClick={handleThemeToggle}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2.5 text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
            aria-label="Cambiar entre modo claro y oscuro"
            title="Alternar tema"
          >
            <svg
              className="hidden h-6 w-6 text-amber-400 dark:block"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <svg
              className="block h-6 w-6 text-slate-700 dark:hidden"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          </button>

          {/* BOTÓN HAMBURGUESA */}
          <button
            type="button"
            id="menu-btn"
            onClick={onMenuToggle}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2.5 text-slate-700 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label="Abrir menú de navegación"
          >
            <svg
              id="menu-icon-bars"
              className={isMenuOpen ? "hidden h-7 w-7" : "block h-7 w-7"}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <svg
              id="menu-icon-close"
              className={isMenuOpen ? "block h-7 w-7" : "hidden h-7 w-7"}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

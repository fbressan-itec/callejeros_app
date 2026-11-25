"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";

export type UserRoleCode = "member" | "verified_shelter" | "staff" | "admin";

/** Ruta del panel de Staff (solo Staff y Admin). */
export const STAFF_PANEL_HREF = "/panel-staff";

export interface MenuUser {
  name: string;
  email?: string;
  role?: UserRoleCode;
}

export interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user?: MenuUser | null;
  onLogout?: () => void;
}

interface MenuLinkItem {
  href: string;
  label: string;
  variant?: "default" | "alert";
}

interface MenuGroup {
  title: string;
  hoverColorClasses: string;
  icon: ReactNode;
  links: readonly MenuLinkItem[];
}

const MENU_GROUPS: readonly MenuGroup[] = [
  {
    title: "Adoptá un Callejero",
    hoverColorClasses:
      "hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500",
    icon: (
      <svg
        className="h-5 w-5 text-orange-500"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
    links: [
      { href: "/adopciones", label: "Adoptar" },
      { href: "/adopciones/publicar", label: "Publicar" },
      { href: "/alertas", label: "🚨 Alerta Callejero!", variant: "alert" },
    ],
  },
  {
    title: "Noticias",
    hoverColorClasses:
      "hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600",
    icon: (
      <svg
        className="h-5 w-5 text-emerald-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
        />
      </svg>
    ),
    links: [{ href: "/noticias", label: "Eventos Benéficos y Noticias" }],
  },
  {
    title: "Información",
    hoverColorClasses:
      "hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600",
    icon: (
      <svg
        className="h-5 w-5 text-blue-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    links: [
      { href: "/quienes-somos", label: "Quiénes Somos" },
      { href: "/adopcion-responsable", label: "Adopción Responsable" },
    ],
  },
  {
    title: "Quiero Colaborar",
    hoverColorClasses:
      "hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600",
    icon: (
      <svg
        className="h-5 w-5 text-rose-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
    links: [
      { href: "/donaciones", label: "Donaciones" },
      {
        href: "/donaciones#apadrinar",
        label: "Colaboraciones y Apadrinamientos",
      },
      { href: "/tienda", label: "Tienda" },
    ],
  },
];

function getNormalizedSectionPath(pathname: string): string {
  const cleanPath = pathname.split("#")[0]?.replace(/\/+$/, "") || "/";
  if (cleanPath.startsWith("/noticias/") || cleanPath === "/noticia") {
    return "/noticias";
  }
  return cleanPath;
}

function isLinkActive(href: string, currentPathname: string): boolean {
  if (href.includes("#")) {
    return false;
  }
  const sectionPath = getNormalizedSectionPath(currentPathname);
  return href === sectionPath;
}

export function MobileMenu({
  isOpen,
  onClose,
  user = null,
  onLogout,
}: MobileMenuProps) {
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        document.getElementById("menu-btn")?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  function getLinkClasses(
    item: MenuLinkItem,
    groupHoverClasses: string,
  ): string {
    const active = isLinkActive(item.href, pathname);
    if (item.variant === "alert") {
      return `inline-flex min-h-[44px] items-center rounded-full bg-red-600 px-4 text-sm font-bold text-white shadow-xs transition-colors hover:bg-red-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900 ${
        active ? "ring-2 ring-orange-500" : ""
      }`;
    }

    const baseClasses =
      "inline-flex items-center min-h-[44px] px-4 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 transition-colors shadow-xs active:scale-95 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";
    const activeClasses = active
      ? "ring-2 ring-orange-500 font-bold"
      : "font-medium";

    return `${baseClasses} ${groupHoverClasses} ${activeClasses}`;
  }

  const userInitial = (user?.name?.trim().charAt(0) || "?").toUpperCase();

  return (
    <>
      <div
        id="menu-backdrop"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none hidden opacity-0"
        }`}
        aria-hidden="true"
      />

      <nav
        id="mobile-menu"
        inert={!isOpen}
        aria-label="Menú principal de navegación"
        className={`fixed top-16 right-0 z-40 flex h-[calc(100vh-4rem)] w-full transform flex-col justify-between overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-300 ease-in-out sm:max-w-md dark:border-slate-800 dark:bg-slate-900 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="space-y-6">
          {/* ESTADO DE LA SESIÓN */}
          <div
            id="user-status-container"
            className="border-b border-slate-100 pb-4 dark:border-slate-800"
          >
            {user ? (
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                      Cuenta activa
                    </span>
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      ¡Hola, {user.name}!
                    </p>
                    {(user.role === "staff" || user.role === "admin") && (
                      <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                        🛡️ Staff Callejeros
                      </span>
                    )}
                    {user.role === "verified_shelter" && (
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                        ✓ Refugio verificado
                      </span>
                    )}
                  </div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white shadow-md"
                    aria-hidden="true"
                  >
                    {userInitial}
                  </div>
                </div>

                {(user.role === "staff" || user.role === "admin") && (
                  <Link
                    href={STAFF_PANEL_HREF}
                    onClick={onClose}
                    aria-current={
                      isLinkActive(STAFF_PANEL_HREF, pathname)
                        ? "page"
                        : undefined
                    }
                    className={`mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 shadow-xs transition-all hover:bg-violet-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/40 dark:focus-visible:ring-offset-slate-900 ${
                      isLinkActive(STAFF_PANEL_HREF, pathname)
                        ? "ring-2 ring-orange-500"
                        : ""
                    }`}
                  >
                    🛡️ Panel de Staff
                  </Link>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href="/mi-cuenta"
                    onClick={onClose}
                    aria-current={
                      isLinkActive("/mi-cuenta", pathname) ? "page" : undefined
                    }
                    className={`inline-flex min-h-[44px] items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900 ${
                      isLinkActive("/mi-cuenta", pathname)
                        ? "ring-2 ring-orange-500"
                        : ""
                    }`}
                  >
                    ⚙️ Mi cuenta
                  </Link>
                  <button
                    type="button"
                    id="btn-logout"
                    onClick={() => {
                      onLogout?.();
                      onClose();
                    }}
                    className="min-h-[44px] rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40 dark:focus-visible:ring-offset-slate-900"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                      Bienvenido a Callejeros
                    </span>
                    <p className="font-display text-base font-bold text-slate-800 dark:text-slate-100">
                      No Registrado...
                    </p>
                  </div>
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                    aria-hidden="true"
                  >
                    👤
                  </div>
                </div>

                {/* Tarjeta destacada de invitación */}
                <div className="space-y-2 rounded-2xl border border-orange-200/70 bg-linear-to-br from-orange-50 to-amber-50 p-3.5 shadow-xs dark:border-slate-700 dark:from-slate-800 dark:to-slate-750">
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    ¡Conectate con la comunidad! Registrate para adoptar,
                    publicar casos de rescate o reportar alertas comunitarias.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href="/registro"
                      onClick={onClose}
                      aria-current={
                        isLinkActive("/registro", pathname) ? "page" : undefined
                      }
                      className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-orange-500 px-3 py-2 text-center text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900 ${
                        isLinkActive("/registro", pathname)
                          ? "ring-2 ring-orange-500"
                          : ""
                      }`}
                    >
                      Registrarme
                    </Link>
                    <Link
                      href="/login"
                      onClick={onClose}
                      aria-current={
                        isLinkActive("/login", pathname) ? "page" : undefined
                      }
                      className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:focus-visible:ring-offset-slate-900 ${
                        isLinkActive("/login", pathname)
                          ? "ring-2 ring-orange-500"
                          : ""
                      }`}
                    >
                      Iniciar Sesión
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* GRUPOS DE NAVEGACIÓN */}
          {MENU_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="flex items-center gap-2.5 font-display text-base font-bold text-slate-900 dark:text-white">
                {group.icon}
                <h3>{group.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2 pl-7">
                {group.links.map((item) => {
                  const active = isLinkActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={getLinkClasses(item, group.hoverColorClasses)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}

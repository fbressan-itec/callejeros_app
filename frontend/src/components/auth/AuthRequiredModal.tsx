"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { getSafeRedirect } from "@/lib/auth/session";

export interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  redirectTo?: string;
  cancelLabel?: string;
}

const DEFAULT_DESCRIPTION =
  "Para postularte a la adopción responsable es obligatorio ingresar con tu cuenta. Así podremos ponernos en contacto para coordinar la entrevista y el seguimiento.";

export function AuthRequiredModal({
  isOpen,
  onClose,
  title = "Iniciá sesión para continuar",
  description = DEFAULT_DESCRIPTION,
  redirectTo,
  cancelLabel = "Seguir mirando mascotas",
}: AuthRequiredModalProps) {
  const pathname = usePathname() || "/";
  const safeRedirect = getSafeRedirect(redirectTo ?? pathname);
  const encodedRedirect = encodeURIComponent(safeRedirect);

  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add("overflow-hidden");
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-auth-required"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-required-title"
      aria-describedby="auth-required-text"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm space-y-5 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-7 dark:border-slate-800 dark:bg-slate-900">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-3xl text-orange-600 shadow-inner dark:bg-orange-950/60 dark:text-orange-400"
          aria-hidden="true"
        >
          🔒
        </div>

        <div className="space-y-2">
          <h3
            id="auth-required-title"
            className="font-display text-xl font-extrabold text-slate-900 dark:text-white"
          >
            {title}
          </h3>
          <p
            id="auth-required-text"
            className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300"
          >
            {description}
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          <Link
            id="auth-required-login"
            href={`/login?redirect=${encodedRedirect}`}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-orange-500 py-3 font-display text-xs font-bold tracking-wider text-white uppercase shadow-md transition-all hover:bg-orange-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
          >
            Iniciar Sesión
          </Link>
          <Link
            id="auth-required-register"
            href={`/registro?redirect=${encodedRedirect}`}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-100 py-3 font-display text-xs font-bold tracking-wider text-slate-700 uppercase transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
          >
            Crear Cuenta / Registrarme
          </Link>
          {onClose && (
            <button
              type="button"
              id="btn-close-auth-required"
              onClick={onClose}
              className="min-h-[44px] px-3 text-xs font-semibold text-slate-600 underline underline-offset-4 transition-colors hover:text-slate-900 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:text-slate-300 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

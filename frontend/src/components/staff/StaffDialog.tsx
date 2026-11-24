"use client";

import { type ReactNode, useEffect, useId } from "react";

export const DIALOG_SECONDARY_BUTTON_CLASSES =
  "min-h-[44px] flex-1 rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900";

export interface StaffDialogProps {
  kicker: string;
  title: string;
  /** Mientras se envía no se puede cerrar (ni con Escape). */
  isBusy: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Modal de confirmación del panel de Staff, con el mismo estilo que el cuestionario de
 * adopción (`AdoptionQuestionnaireModal`). Bloquea el scroll y se cierra con Escape.
 */
export function StaffDialog({
  kicker,
  title,
  isBusy,
  onClose,
  children,
}: StaffDialogProps) {
  const titleId = useId();

  // Al cerrar, el foco vuelve al botón que abrió el modal (si sigue en la página)
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-md space-y-5 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <span className="text-xs font-extrabold tracking-wider text-violet-700 uppercase dark:text-violet-300">
              {kicker}
            </span>
            <h2
              id={titleId}
              className="mt-0.5 font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-500 hover:text-slate-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-60 dark:text-slate-400 dark:hover:text-white"
            aria-label="Cerrar modal"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DialogError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      {message}
    </p>
  );
}

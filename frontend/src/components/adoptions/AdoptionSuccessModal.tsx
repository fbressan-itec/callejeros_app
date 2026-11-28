"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export interface AdoptionSuccessModalProps {
  isOpen: boolean;
  petName: string;
  onClose: () => void;
}

/** Modal "¡Datos enviados correctamente!" del maquetado (`mascota.html`). */
export function AdoptionSuccessModal({
  isOpen,
  petName,
  onClose,
}: AdoptionSuccessModalProps) {
  const homeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add("overflow-hidden");
    homeLinkRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
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
      id="modal-exito-envio"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-exito-titulo"
      aria-describedby="modal-exito-texto"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 shadow-inner dark:bg-emerald-950/60"
        >
          ✓
        </div>
        <div>
          <h3
            id="modal-exito-titulo"
            className="font-display text-xl font-bold text-slate-900 dark:text-white"
          >
            ¡Datos enviados correctamente!
          </h3>
          <p
            id="modal-exito-texto"
            className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300"
          >
            Te avisaremos en tus notificaciones si la solicitud para adoptar a{" "}
            {petName} es aceptada.
          </p>
        </div>
        <Link
          ref={homeLinkRef}
          href="/"
          id="btn-modal-ir-inicio"
          className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-orange-700 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
        >
          Ir al inicio
        </Link>
        {/* Sin destino hasta FR-11 (#29), que arma la página de notificaciones */}
        <button
          type="button"
          aria-disabled="true"
          className="flex min-h-[44px] w-full items-center justify-center text-xs font-bold text-orange-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:text-orange-400 dark:focus-visible:ring-offset-slate-900"
        >
          🔔 Ver mis notificaciones
        </button>
      </div>
    </div>
  );
}

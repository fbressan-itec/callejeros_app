"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import type { PetDetail } from "@/lib/pets/types";

export const OWN_PET_ADOPTION_MESSAGE =
  "No podés postularte para adoptar una mascota que publicaste vos mismo.";

export interface PetActionsProps {
  pet: PetDetail;
  /** Abre el cuestionario de adopción (con sesión y si la mascota no es propia). */
  onAdoptClick?: (pet: PetDetail) => void;
}

export function PetActions({ pet, onAdoptClick }: PetActionsProps) {
  const { user, isAuthenticated } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showOwnPetNotice, setShowOwnPetNotice] = useState(false);

  const isAdopted = pet.status === "adopted";

  function handleAdoptClick() {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    // Quien publicó no se postula: se avisa sin abrir el cuestionario (el back lo controla igual)
    if (user?.id === pet.published_by.id) {
      setShowOwnPetNotice(true);
      return;
    }
    onAdoptClick?.(pet);
  }

  function handleShareClick() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Conocé a ${pet.name}, busca una familia en Río Cuarto 🐾`;

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      navigator
        .share({
          title: `${pet.name} — Callejeros Río Cuarto`,
          text,
          url,
        })
        .catch(() => {});
      return;
    }

    if (typeof window !== "undefined") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 pt-1">
        {isAdopted ? (
          <div
            role="status"
            className="flex flex-col items-center gap-1 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-center dark:border-orange-900/60 dark:bg-orange-950/30"
          >
            <p className="font-display text-base font-bold text-orange-800 dark:text-orange-200">
              ¡Ya encontró hogar! 🧡
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {pet.name} ya fue {pet.sex === "female" ? "adoptada" : "adoptado"}{" "}
              y está con su nueva familia.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              id="btn-pet-adopt"
              onClick={handleAdoptClick}
              className="min-h-[52px] w-full rounded-2xl bg-orange-700 font-display text-base font-bold text-white shadow-lg shadow-orange-700/25 transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
            >
              ¡Adoptame!
            </button>

            {showOwnPetNotice ? (
              <p
                role="status"
                aria-live="polite"
                className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-center text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {OWN_PET_ADOPTION_MESSAGE}
              </p>
            ) : null}
          </>
        )}

        <Link
          href="/donaciones#apadrinar"
          className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
        >
          Donaciones y Apadrinamiento
        </Link>

        <button
          type="button"
          id="btn-pet-share"
          onClick={handleShareClick}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-orange-700 transition-colors hover:bg-orange-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:text-orange-400 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
        >
          📤 Compartir a {pet.name}
        </button>
      </div>

      <AuthRequiredModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        description={`Para postularte a la adopción responsable de ${pet.name} es obligatorio ingresar con tu cuenta. Así podremos ponernos en contacto para coordinar la entrevista y el seguimiento.`}
        redirectTo={`/mascotas/${pet.id}`}
      />
    </>
  );
}

"use client";

import { useState } from "react";

import { getActionErrorMessage } from "@/lib/api/errors";
import { setPetUrgency } from "@/lib/pets/review";
import type { PetReviewItem } from "@/lib/pets/types";

export interface PetUrgencyControlProps {
  pet: PetReviewItem;
  onChanged: (pet: PetReviewItem) => void;
}

/**
 * Caso urgente pedido por quien publicó: Staff lo valida o le quita la validación
 * (`POST /api/pets/{id}/urgency/`). Recién validado se muestra en el catálogo.
 */
export function PetUrgencyControl({ pet, onChanged }: PetUrgencyControlProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pet.is_urgent_requested) return null;

  const isValidated = pet.is_urgent_validated;

  async function handleToggle() {
    setError(null);
    setIsSaving(true);
    try {
      onChanged(await setPetUrgency(pet.id, !isValidated));
    } catch (caught) {
      setError(getActionErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
      <div>
        <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
          🚨 Pidió caso urgente
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {isValidated
            ? "✓ Validado: al aprobarla, se muestra como urgente en el catálogo."
            : "Sin validar: no se muestra como urgente hasta que lo valides."}
        </p>
      </div>
      {error ? (
        <p
          role="alert"
          className="text-xs font-semibold text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={isSaving}
        aria-pressed={isValidated}
        className={`min-h-[44px] rounded-xl px-4 text-sm font-bold transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-slate-800 ${
          isValidated
            ? "border border-rose-300 bg-white text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-slate-700"
            : "bg-rose-600 text-white shadow-xs hover:bg-rose-700"
        }`}
      >
        {isSaving
          ? isValidated
            ? "Quitando validación…"
            : "Validando…"
          : isValidated
            ? "Quitar validación"
            : "Validar urgente"}
      </button>
    </div>
  );
}

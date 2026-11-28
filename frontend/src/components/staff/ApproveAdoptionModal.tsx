"use client";

import { useEffect, useRef, useState } from "react";

import {
  ActionDialog,
  DIALOG_SECONDARY_BUTTON_CLASSES,
  DialogError,
} from "@/components/ui/ActionDialog";
import { approveAdoptionRequest } from "@/lib/adoptions/api";
import {
  getApplicantName,
  getReviewErrorMessage,
} from "@/lib/adoptions/review";
import type { AdoptionRequestReview } from "@/lib/adoptions/types";

export interface ApproveAdoptionModalProps {
  request: AdoptionRequestReview;
  onClose: () => void;
  onApproved: (request: AdoptionRequestReview) => void;
  /** Avisa que falló (la cola puede haber cambiado: se vuelve a pedir al cerrar). */
  onFailed: () => void;
}

export function ApproveAdoptionModal({
  request,
  onClose,
  onApproved,
  onFailed,
}: ApproveAdoptionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  // El foco arranca en "Cancelar": confirmar tiene que ser una decisión explícita
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  async function handleConfirm() {
    setError(null);
    setIsSubmitting(true);
    try {
      const approved = await approveAdoptionRequest(request.id);
      onApproved(approved);
    } catch (caught) {
      setError(getReviewErrorMessage(caught));
      setIsSubmitting(false);
      onFailed();
    }
  }

  return (
    <ActionDialog
      kickerTone="violet"
      autoFocusClose={false}
      kicker="Solicitud de adopción"
      title="Aprobar solicitud"
      isBusy={isSubmitting}
      onClose={onClose}
    >
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        ¿Aprobar la solicitud de <strong>{getApplicantName(request)}</strong>{" "}
        para <strong>{request.pet.name}</strong>? Va a recibir el teléfono de
        contacto de la publicación.
      </p>
      <DialogError message={error} />
      <div className="flex gap-3 pt-1">
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className={DIALOG_SECONDARY_BUTTON_CLASSES}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="min-h-[44px] flex-1 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
        >
          {isSubmitting ? "Aprobando…" : "Confirmar"}
        </button>
      </div>
    </ActionDialog>
  );
}

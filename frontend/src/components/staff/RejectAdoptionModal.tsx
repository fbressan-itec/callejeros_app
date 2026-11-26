"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { TextAreaField } from "@/components/adoptions/QuestionnaireFields";
import {
  ActionDialog,
  DIALOG_SECONDARY_BUTTON_CLASSES,
  DialogError,
} from "@/components/ui/ActionDialog";
import { rejectAdoptionRequest } from "@/lib/adoptions/api";
import {
  getApplicantName,
  getReviewErrorMessage,
  MAX_REJECTION_REASON_LENGTH,
  type RejectAdoptionRequestValues,
  rejectAdoptionRequestSchema,
} from "@/lib/adoptions/review";
import type { AdoptionRequestReview } from "@/lib/adoptions/types";
import { ApiError } from "@/lib/api/client";

const REASON_FIELD_ID = "reject-reason";

export interface RejectAdoptionModalProps {
  request: AdoptionRequestReview;
  onClose: () => void;
  onRejected: (request: AdoptionRequestReview) => void;
  /** Avisa que falló (la cola puede haber cambiado: se vuelve a pedir al cerrar). */
  onFailed: () => void;
}

export function RejectAdoptionModal({
  request,
  onClose,
  onRejected,
  onFailed,
}: RejectAdoptionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<RejectAdoptionRequestValues>({
    resolver: zodResolver(rejectAdoptionRequestSchema),
    defaultValues: { rejection_reason: "" },
  });

  // Al abrir, el foco va directo al campo del motivo
  useEffect(() => {
    document.getElementById(REASON_FIELD_ID)?.focus();
  }, []);

  async function submit(values: RejectAdoptionRequestValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const rejected = await rejectAdoptionRequest(
        request.id,
        values.rejection_reason,
      );
      onRejected(rejected);
    } catch (caught) {
      const reasonError =
        caught instanceof ApiError
          ? caught.fieldErrors.rejection_reason?.[0]
          : undefined;
      if (reasonError) {
        setFieldError(
          "rejection_reason",
          { type: "server", message: reasonError },
          { shouldFocus: true },
        );
      } else {
        setError(getReviewErrorMessage(caught));
        onFailed();
      }
      setIsSubmitting(false);
    }
  }

  return (
    <ActionDialog
      kickerTone="violet"
      autoFocusClose={false}
      kicker="Solicitud de adopción"
      title="Desaprobar solicitud"
      isBusy={isSubmitting}
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={(event) => {
          if (isSubmitting) {
            event.preventDefault();
            return;
          }
          void handleSubmit(submit)(event);
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          Contale a <strong>{getApplicantName(request)}</strong> por qué no
          aprobamos su solicitud para <strong>{request.pet.name}</strong>. Lo va
          a leer en &quot;¿Por qué?&quot;.
        </p>
        <DialogError message={error} />
        <TextAreaField
          id={REASON_FIELD_ID}
          label="Motivo"
          rows={4}
          help={`Hasta ${MAX_REJECTION_REASON_LENGTH} caracteres. Escribilo con respeto: lo lee la persona que quiso adoptar.`}
          registration={register("rejection_reason")}
          error={errors.rejection_reason}
        />
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={DIALOG_SECONDARY_BUTTON_CLASSES}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-xl bg-red-700 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-red-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
          >
            {isSubmitting ? "Desaprobando…" : "Desaprobar"}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}

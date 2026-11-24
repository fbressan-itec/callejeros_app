"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { TextAreaField } from "@/components/adoptions/QuestionnaireFields";
import {
  DIALOG_SECONDARY_BUTTON_CLASSES,
  DialogError,
  StaffDialog,
} from "@/components/staff/StaffDialog";
import { ApiError } from "@/lib/api/client";
import { getActionErrorMessage } from "@/lib/api/errors";
import {
  approvePet,
  DEFAULT_PET_REJECTION_NOTE,
  getPublisherName,
  MAX_PET_REVIEW_NOTE_LENGTH,
  type PetReviewNoteValues,
  petReviewNoteSchema,
  rejectPet,
} from "@/lib/pets/review";
import type { PetReviewItem } from "@/lib/pets/types";

export type PetReviewAction = "approve" | "reject";

const NOTE_FIELD_ID = "pet-review-note";

const ACTION_TEXTS = {
  approve: {
    title: "Aprobar publicación",
    noteLabel: "Nota (opcional)",
    noteHelp: "Queda en el historial de la publicación.",
    submit: "Aprobar",
    submitting: "Aprobando…",
    buttonClasses:
      "bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-500",
  },
  reject: {
    title: "Rechazar publicación",
    noteLabel: "Motivo (opcional)",
    noteHelp: `Si lo dejás vacío, se guarda: "${DEFAULT_PET_REJECTION_NOTE}"`,
    submit: "Rechazar",
    submitting: "Rechazando…",
    buttonClasses: "bg-red-700 hover:bg-red-800 focus-visible:ring-red-500",
  },
} as const;

export interface PetReviewModalProps {
  action: PetReviewAction;
  pet: PetReviewItem;
  onClose: () => void;
  onReviewed: (pet: PetReviewItem) => void;
  /** Avisa que falló (la cola puede haber cambiado: se vuelve a pedir al cerrar). */
  onFailed: () => void;
}

/** Confirmación para aprobar o rechazar una mascota en revisión, con nota opcional. */
export function PetReviewModal({
  action,
  pet,
  onClose,
  onReviewed,
  onFailed,
}: PetReviewModalProps) {
  const texts = ACTION_TEXTS[action];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<PetReviewNoteValues>({
    resolver: zodResolver(petReviewNoteSchema),
    defaultValues: { note: "" },
  });

  // El foco arranca en "Cancelar": confirmar tiene que ser una decisión explícita
  useEffect(() => {
    document.getElementById(`${NOTE_FIELD_ID}-cancel`)?.focus();
  }, []);

  async function submit(values: PetReviewNoteValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const review = action === "approve" ? approvePet : rejectPet;
      onReviewed(await review(pet.id, values.note));
    } catch (caught) {
      const noteError =
        caught instanceof ApiError ? caught.fieldErrors.note?.[0] : undefined;
      if (noteError) {
        setFieldError(
          "note",
          { type: "server", message: noteError },
          { shouldFocus: true },
        );
      } else {
        setError(getActionErrorMessage(caught, ["note"]));
        onFailed();
      }
      setIsSubmitting(false);
    }
  }

  return (
    <StaffDialog
      kicker="Publicación en revisión"
      title={texts.title}
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
          {action === "approve" ? (
            <>
              ¿Aprobar la publicación de <strong>{pet.name}</strong>? Va a
              aparecer en el catálogo de adopción.
            </>
          ) : (
            <>
              ¿Rechazar la publicación de <strong>{pet.name}</strong>? Es final:
              para volver a intentarlo, <strong>{getPublisherName(pet)}</strong>{" "}
              tiene que cargarla de nuevo.
            </>
          )}
        </p>
        <DialogError message={error} />
        <TextAreaField
          id={NOTE_FIELD_ID}
          label={texts.noteLabel}
          required={false}
          rows={3}
          help={`${texts.noteHelp} Hasta ${MAX_PET_REVIEW_NOTE_LENGTH} caracteres.`}
          registration={register("note")}
          error={errors.note}
        />
        <div className="flex gap-3 pt-1">
          <button
            id={`${NOTE_FIELD_ID}-cancel`}
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
            className={`min-h-[44px] flex-1 rounded-xl py-3 text-sm font-bold text-white shadow-md transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-slate-900 ${texts.buttonClasses}`}
          >
            {isSubmitting ? texts.submitting : texts.submit}
          </button>
        </div>
      </form>
    </StaffDialog>
  );
}

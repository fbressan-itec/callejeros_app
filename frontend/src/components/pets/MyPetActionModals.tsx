"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { getActionErrorMessage } from "@/lib/api/errors";
import { adoptPet, deactivatePet } from "@/lib/pets/api";
import type { PetDetail } from "@/lib/pets/types";

const ADOPT_NOTE_MAX_LENGTH = 255;

interface ActionDialogProps {
  kicker: string;
  title: string;
  isBusy: boolean;
  onClose: () => void;
  children: ReactNode;
}

function ActionDialog({
  kicker,
  title,
  isBusy,
  onClose,
  children,
}: ActionDialogProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
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
            <span className="text-xs font-extrabold tracking-wider text-orange-700 uppercase dark:text-orange-400">
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
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Cerrar modal"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-500 transition-colors hover:text-slate-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"
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

export interface AdoptPetModalProps {
  pet: PetDetail;
  onClose: () => void;
  onSuccess: (updatedPet: PetDetail) => void;
}

export function AdoptPetModal({ pet, onClose, onSuccess }: AdoptPetModalProps) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const noteId = useId();
  const countId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const updated = await adoptPet(pet.id, note);
      onSuccess(updated);
    } catch (error: unknown) {
      setErrorMessage(getActionErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <ActionDialog
      kicker="Mis publicaciones"
      title={`Marcar a ${pet.name} como adoptada`}
      isBusy={isSubmitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
          La mascota va a salir del catálogo de disponibles y su ficha va a
          quedar activa con la insignia{" "}
          <strong className="text-slate-900 dark:text-white">
            &ldquo;¡Ya encontró hogar! 🧡&rdquo;
          </strong>
          .
        </p>

        <div>
          <label
            htmlFor={noteId}
            className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
          >
            Nota (opcional)
          </label>
          <textarea
            id={noteId}
            rows={3}
            maxLength={ADOPT_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-describedby={countId}
            placeholder="Ej: Adoptada por una familia de barrio Alberdi."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
          <p
            id={countId}
            className="mt-1 text-right text-[11px] text-slate-600 dark:text-slate-400"
            aria-live="polite"
          >
            {note.length} / {ADOPT_NOTE_MAX_LENGTH}
          </p>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
          >
            {isSubmitting ? "Guardando..." : "Confirmar adopción"}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}

export interface DeactivatePetModalProps {
  pet: PetDetail;
  onClose: () => void;
  onSuccess: (petId: number) => void;
}

export function DeactivatePetModal({
  pet,
  onClose,
  onSuccess,
}: DeactivatePetModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await deactivatePet(pet.id);
      onSuccess(pet.id);
    } catch (error: unknown) {
      setErrorMessage(getActionErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <ActionDialog
      kicker="Mis publicaciones"
      title={`Dar de baja a ${pet.name}`}
      isBusy={isSubmitting}
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
          Esta publicación dejará de estar visible en el catálogo y en tus
          publicaciones activas. ¿Querés continuar?
        </p>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-red-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
          >
            {isSubmitting ? "Dando de baja..." : "Dar de baja"}
          </button>
        </div>
      </div>
    </ActionDialog>
  );
}

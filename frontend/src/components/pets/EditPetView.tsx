"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { BackButton } from "@/components/layout/BackButton";
import { PetForm } from "@/components/pets/PetForm";
import { PetPhotosManager } from "@/components/pets/PetPhotosManager";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import { fetchPetById, parsePetId, updatePet } from "@/lib/pets/api";
import {
  buildUpdatePetPayload,
  type PetFormValues,
  petToFormValues,
} from "@/lib/pets/form";
import type { PetDetail } from "@/lib/pets/types";

export interface EditPetViewProps {
  rawId: string;
}

type EditLoadResult =
  | { status: "success"; pet: PetDetail }
  | { status: "not_found" }
  | { status: "error"; message: string };

type EditLoadState = { status: "loading" } | EditLoadResult;

export function EditPetView({ rawId }: EditPetViewProps) {
  const { user } = useAuth();
  const petId = parsePetId(rawId);

  const [reloadCount, setReloadCount] = useState(0);
  const [fetched, setFetched] = useState<{
    key: string;
    result: EditLoadResult;
  } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const requestKey = `${petId ?? "invalid"}:${reloadCount}`;

  const handleRetry = useCallback(() => {
    setReloadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (petId === null) return;
    const controller = new AbortController();

    fetchPetById(petId, { signal: controller.signal })
      .then((pet) => {
        if (controller.signal.aborted) return;
        setFetched({ key: requestKey, result: { status: "success", pet } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setFetched({ key: requestKey, result: { status: "not_found" } });
          return;
        }
        const message =
          error instanceof ApiError ? error.message : ERROR_MESSAGES.unknown;
        setFetched({
          key: requestKey,
          result: { status: "error", message },
        });
      });

    return () => {
      controller.abort();
    };
  }, [petId, requestKey]);

  const state: EditLoadState =
    petId === null
      ? { status: "not_found" }
      : fetched?.key === requestKey
        ? fetched.result
        : { status: "loading" };

  if (state.status === "loading") {
    return <LoadingScreen message="Cargando publicación..." />;
  }

  if (state.status === "not_found") {
    return (
      <main className="mx-auto w-full max-w-lg grow px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        <div className="mb-4">
          <BackButton fallbackHref="/mis-publicaciones" />
        </div>
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-soft sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-soft-dark">
          <span className="block text-4xl" aria-hidden="true">
            🐾
          </span>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            No encontramos esta publicación
          </h1>
          <p className="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Es posible que haya sido dada de baja o que no tengas permiso para
            editarla.
          </p>
          <Link
            href="/mis-publicaciones"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 py-2.5 font-display text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
          >
            Volver a Mis publicaciones
          </Link>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-lg grow px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        <div className="mb-4">
          <BackButton fallbackHref="/mis-publicaciones" />
        </div>
        <section
          role="alert"
          className="space-y-4 rounded-3xl border border-red-200 bg-white p-6 text-center shadow-soft sm:p-8 dark:border-red-900/60 dark:bg-slate-900 dark:shadow-soft-dark"
        >
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            {state.message}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  const pet = state.pet;
  const isStaffOrAdmin =
    user?.role.code === "staff" || user?.role.code === "admin";
  const canEdit =
    user !== null && (pet.published_by.id === user.id || isStaffOrAdmin);

  if (!canEdit) {
    return (
      <main className="mx-auto w-full max-w-lg grow px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        <div className="mb-4">
          <BackButton fallbackHref="/mis-publicaciones" />
        </div>
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-soft sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-soft-dark">
          <span className="block text-4xl" aria-hidden="true">
            🐾
          </span>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            No encontramos esta publicación
          </h1>
          <p className="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Es posible que haya sido dada de baja o que no tengas permiso para
            editarla.
          </p>
          <Link
            href="/mis-publicaciones"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 py-2.5 font-display text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
          >
            Volver a Mis publicaciones
          </Link>
        </section>
      </main>
    );
  }

  const willReturnToReview = pet.status === "published" && !isStaffOrAdmin;

  if (pet.status === "rejected") {
    return (
      <main className="mx-auto w-full max-w-lg grow px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        <div className="mb-4">
          <BackButton fallbackHref="/mis-publicaciones" />
        </div>
        <section className="space-y-4 rounded-3xl border border-red-200 bg-white p-6 text-center shadow-soft sm:p-8 dark:border-red-900/60 dark:bg-slate-900 dark:shadow-soft-dark">
          <span className="block text-4xl" aria-hidden="true">
            🚫
          </span>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            Publicación rechazada
          </h1>
          <p className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
            Una publicación rechazada no se puede editar ni cambiar sus fotos.
            Para volver a publicar a{" "}
            <strong className="text-slate-900 dark:text-white">
              {pet.name}
            </strong>
            , cargá una nueva publicación.
          </p>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Link
              href="/mis-publicaciones"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Volver a Mis publicaciones
            </Link>
            <Link
              href="/adopciones/publicar"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-orange-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800"
            >
              Cargar nueva publicación
            </Link>
          </div>
        </section>
      </main>
    );
  }

  async function handleSaveChanges(values: PetFormValues): Promise<void> {
    const previousStatus = pet.status;
    const payload = buildUpdatePetPayload(values, pet);
    if (Object.keys(payload).length === 0) {
      setFeedbackMessage("No hiciste cambios.");
      return;
    }

    const updated = await updatePet(pet.id, payload);

    setFetched({
      key: requestKey,
      result: { status: "success", pet: updated },
    });
    setFeedbackMessage(
      previousStatus === "published" && updated.status === "in_review"
        ? "Cambios guardados. La publicación volvió a «En revisión» hasta que un voluntario la apruebe."
        : "Cambios guardados correctamente.",
    );
  }

  async function handlePhotosChanged(action: "added" | "deleted") {
    const previousStatus = pet.status;
    const refreshed = await fetchPetById(pet.id);
    setFetched({
      key: requestKey,
      result: { status: "success", pet: refreshed },
    });

    const baseMessage =
      action === "added"
        ? "Foto agregada al carrusel."
        : "Foto eliminada del carrusel.";

    setFeedbackMessage(
      previousStatus === "published" && refreshed.status === "in_review"
        ? `${baseMessage} La publicación volvió a «En revisión» hasta que un voluntario la apruebe.`
        : baseMessage,
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg grow space-y-6 px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <div className="flex items-center justify-between gap-2">
        <BackButton fallbackHref="/mis-publicaciones" />
        <Link
          href={`/mascotas/${pet.id}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Ver ficha
        </Link>
      </div>

      {willReturnToReview ? (
        <div
          role="note"
          className="rounded-2xl border border-amber-300 bg-amber-100 px-4 py-3 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        >
          Al guardar cambios o modificar fotos de una publicación aprobada,
          volverá a estado <strong>«En revisión»</strong> y saldrá del catálogo
          hasta que un voluntario la apruebe de nuevo.
        </div>
      ) : null}

      <PetPhotosManager
        petId={pet.id}
        petName={pet.name}
        photos={pet.photos}
        willReturnToReview={willReturnToReview}
        onPhotosChanged={handlePhotosChanged}
      />

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-soft-dark">
        <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
          <span className="text-xs font-extrabold tracking-wider text-orange-700 uppercase dark:text-orange-400">
            Mis publicaciones
          </span>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            Editar a {pet.name}
          </h1>
        </div>

        <PetForm
          key={`${pet.id}:${pet.updated_at}`}
          defaultValues={petToFormValues(pet)}
          requirePhotos={false}
          submitLabel="Guardar cambios"
          submittingLabel="Guardando..."
          helperNote={
            willReturnToReview
              ? "Si modificás algún dato, un voluntario revisará la publicación antes de volver a mostrarla en el catálogo."
              : "Los cambios se guardan directamente en la ficha."
          }
          onSubmitPet={handleSaveChanges}
        />
      </section>

      {feedbackMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-950 shadow-lg dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
        >
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            aria-label="Cerrar aviso"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-emerald-900 hover:bg-emerald-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
          >
            ✕
          </button>
        </div>
      ) : null}
    </main>
  );
}

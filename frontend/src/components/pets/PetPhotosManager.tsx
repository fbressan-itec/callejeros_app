"use client";

import Image from "next/image";
import { type ChangeEvent, useState } from "react";

import { getActionErrorMessage } from "@/lib/api/errors";
import {
  addPetPhoto,
  deletePetPhoto,
  resolvePetImageUrl,
} from "@/lib/pets/api";
import { validatePetPhotoFile } from "@/lib/pets/form";
import type { PetPhoto } from "@/lib/pets/types";

export interface PetPhotosManagerProps {
  petId: number;
  petName: string;
  photos: readonly PetPhoto[];
  onPhotosChanged: (action: "added" | "deleted") => Promise<void> | void;
}

export function PetPhotosManager({
  petId,
  petName,
  photos,
  onPhotosChanged,
}: PetPhotosManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orderedPhotos = [...photos].sort(
    (a, b) => a.position - b.position || a.id - b.id,
  );
  const isOnlyPhoto = orderedPhotos.length <= 1;
  const isBusy = isUploading || deletingPhotoId !== null;

  async function handleAddPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validatePetPhotoFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);

    try {
      await addPetPhoto(petId, file);
      await onPhotosChanged("added");
    } catch (error: unknown) {
      setErrorMessage(getActionErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeletePhoto(photoId: number) {
    if (isOnlyPhoto) {
      setErrorMessage("La mascota debe conservar al menos una foto activa.");
      return;
    }

    setErrorMessage(null);
    setDeletingPhotoId(photoId);

    try {
      await deletePetPhoto(petId, photoId);
      await onPhotosChanged("deleted");
    } catch (error: unknown) {
      setErrorMessage(getActionErrorMessage(error));
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <section
      aria-labelledby="edit-photos-heading"
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-soft-dark"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <span className="text-xs font-extrabold tracking-wider text-orange-700 uppercase dark:text-orange-400">
            Carrusel de fotos
          </span>
          <h2
            id="edit-photos-heading"
            className="mt-0.5 font-display text-lg font-extrabold text-slate-900 dark:text-white"
          >
            Fotos de {petName} ({orderedPhotos.length})
          </h2>
        </div>

        <label
          className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-orange-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 hover:bg-orange-800 active:scale-95 dark:focus-within:ring-offset-slate-900 ${
            isBusy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isBusy}
            onChange={handleAddPhoto}
            className="sr-only"
            aria-label="Agregar nueva foto"
          />
          <span>{isUploading ? "Subiendo foto..." : "+ Agregar foto"}</span>
        </label>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}

      <ul
        aria-label="Fotos actuales de la mascota"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {orderedPhotos.map((photo, index) => {
          const isDeletingThis = deletingPhotoId === photo.id;
          return (
            <li
              key={photo.id}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="relative h-32 w-full">
                <Image
                  src={resolvePetImageUrl(photo.image)}
                  alt={`Foto ${index + 1} de ${petName}`}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>

              {index === 0 ? (
                <span className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white">
                  Portada
                </span>
              ) : null}

              <button
                type="button"
                disabled={isBusy || isOnlyPhoto}
                onClick={() => void handleDeletePhoto(photo.id)}
                aria-label={`Eliminar foto ${index + 1}`}
                title={
                  isOnlyPhoto
                    ? "La mascota debe conservar al menos una foto activa."
                    : `Eliminar foto ${index + 1}`
                }
                className="absolute top-1.5 right-1.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-900/75 text-xs font-bold text-white transition-colors hover:bg-red-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeletingThis ? "…" : "✕"}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-slate-600 dark:text-slate-400">
        Formatos permitidos: JPG, PNG o WEBP (hasta 5 MB).{" "}
        {isOnlyPhoto
          ? "La mascota debe conservar al menos una foto activa."
          : "La primera foto se muestra como portada en el catálogo."}
      </p>
    </section>
  );
}

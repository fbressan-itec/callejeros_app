"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ApiError } from "@/lib/api/client";
import { getActionErrorMessage } from "@/lib/api/errors";
import {
  DEFAULT_PET_FORM_VALUES,
  PET_AGE_MAX,
  PET_AGE_MIN,
  PET_CONTACT_PHONE_MAX_LENGTH,
  PET_DESCRIPTION_MAX_LENGTH,
  PET_NAME_MAX_LENGTH,
  PET_PHOTO_REQUIRED_ERROR,
  PET_SPECIAL_CARE_MAX_LENGTH,
  petFormSchema,
  type PetFormValues,
  validatePetPhotoFile,
} from "@/lib/pets/form";

interface SelectedPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const BACKEND_FIELD_TO_FORM_FIELD: Partial<
  Record<string, keyof PetFormValues>
> = {
  name: "name",
  species: "species",
  sex: "sex",
  estimated_birth_date: "ageValue",
  is_neutered: "isNeutered",
  is_sociable: "isSociable",
  good_with_children: "goodWithChildren",
  good_with_animals: "goodWithAnimals",
  is_urgent_requested: "isUrgentRequested",
  special_care: "specialCare",
  contact_phone: "contactPhone",
  description: "description",
};

const INPUT_BASE_CLASS =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

const SELECT_BASE_CLASS =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500 dark:border-slate-700 dark:bg-slate-850 dark:text-white";

export interface PetFormProps {
  defaultValues?: Partial<PetFormValues>;
  /** Si es `true`, muestra la zona de carga de fotos obligatoria (modo publicar). */
  requirePhotos?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  helperNote?: string;
  onSubmitPet: (
    values: PetFormValues,
    photos: readonly File[],
  ) => Promise<void>;
}

/**
 * Formulario de publicación y edición de mascota, fiel a `adopciones.html`
 * adaptado a Tailwind 4, WCAG AA y modo claro/oscuro.
 */
export function PetForm({
  defaultValues,
  requirePhotos = true,
  submitLabel = "Enviar para revisión",
  submittingLabel = "Publicando...",
  helperNote = "Un voluntario revisa cada publicación antes de que aparezca en el catálogo.",
  onSubmitPet,
}: PetFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<PetFormValues>({
    resolver: zodResolver(petFormSchema),
    defaultValues: {
      ...DEFAULT_PET_FORM_VALUES,
      ...defaultValues,
    },
  });

  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const photosRef = useRef<SelectedPhoto[]>([]);

  useEffect(() => {
    photosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  useEffect(() => {
    return () => {
      for (const item of photosRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const hasSpecialCare = useWatch({ control, name: "hasSpecialCare" });
  const specialCareValue = useWatch({ control, name: "specialCare" }) ?? "";
  const descriptionValue = useWatch({ control, name: "description" }) ?? "";

  const specialCareLength = specialCareValue.length;
  const descriptionLength = descriptionValue.length;

  function handleSpecialCareToggle(event: ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;
    setValue("hasSpecialCare", checked, { shouldDirty: true });
    if (!checked) {
      setValue("specialCare", "", { shouldDirty: true });
      clearErrors("specialCare");
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const validAdditions: SelectedPhoto[] = [];
    let firstError: string | null = null;

    for (const file of files) {
      const error = validatePetPhotoFile(file);
      if (error) {
        firstError ??= error;
        continue;
      }
      validAdditions.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (validAdditions.length > 0) {
      setSelectedPhotos((prev) => [...prev, ...validAdditions]);
    }
    setPhotoError(firstError);
    // Permite volver a elegir el mismo archivo si el usuario lo quitó antes.
    event.target.value = "";
  }

  function handleRemovePhoto(photoId: string) {
    setSelectedPhotos((prev) => {
      const target = prev.find((item) => item.id === photoId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== photoId);
    });
  }

  async function onValidSubmit(values: PetFormValues) {
    setGeneralError(null);

    if (requirePhotos && selectedPhotos.length === 0) {
      setPhotoError(PET_PHOTO_REQUIRED_ERROR);
      document
        .getElementById("pub-dropzone")
        ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }

    setPhotoError(null);

    try {
      await onSubmitPet(
        values,
        selectedPhotos.map((item) => item.file),
      );
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        const inlineHandled: string[] = [];

        for (const [backendField, messages] of Object.entries(
          error.fieldErrors,
        )) {
          const firstMessage = messages[0];
          if (!firstMessage) continue;

          if (backendField === "photos") {
            setPhotoError(firstMessage);
            inlineHandled.push("photos");
            continue;
          }

          const formField = BACKEND_FIELD_TO_FORM_FIELD[backendField];
          if (formField) {
            setError(formField, { type: "server", message: firstMessage });
            inlineHandled.push(backendField);
          }
        }

        const hasUnhandledErrors =
          Object.keys(error.fieldErrors).length === 0 ||
          Object.keys(error.fieldErrors).some(
            (field) => !inlineHandled.includes(field),
          );

        if (hasUnhandledErrors) {
          setGeneralError(getActionErrorMessage(error, inlineHandled));
        }
        return;
      }

      setGeneralError(getActionErrorMessage(error));
    }
  }

  return (
    <form
      id="form-publicar-mascota"
      onSubmit={handleSubmit(onValidSubmit)}
      noValidate
      className="space-y-4"
    >
      {generalError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {generalError}
        </div>
      ) : null}

      {/* Nombre y Especie */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="pub-name"
            className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
          >
            Nombre *
          </label>
          <input
            id="pub-name"
            type="text"
            maxLength={PET_NAME_MAX_LENGTH}
            placeholder="Ej: Manchitas"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "pub-name-error" : undefined}
            className={INPUT_BASE_CLASS}
            {...register("name")}
          />
          {errors.name ? (
            <p
              id="pub-name-error"
              role="alert"
              className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="pub-specie"
            className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
          >
            Especie *
          </label>
          <select
            id="pub-specie"
            aria-invalid={Boolean(errors.species)}
            className={SELECT_BASE_CLASS}
            {...register("species")}
          >
            <option value="dog">🐶 Perro</option>
            <option value="cat">🐱 Gato</option>
          </select>
          {errors.species ? (
            <p
              role="alert"
              className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {errors.species.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* Sexo y Edad */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="pub-sex"
            className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
          >
            Sexo *
          </label>
          <select
            id="pub-sex"
            aria-invalid={Boolean(errors.sex)}
            className={SELECT_BASE_CLASS}
            {...register("sex")}
          >
            <option value="male">Macho ♂</option>
            <option value="female">Hembra ♀</option>
          </select>
          {errors.sex ? (
            <p
              role="alert"
              className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {errors.sex.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="pub-age"
            className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
          >
            Edad aproximada *
          </label>
          <div className="flex gap-2">
            <input
              id="pub-age"
              type="number"
              min={PET_AGE_MIN}
              max={PET_AGE_MAX}
              inputMode="numeric"
              placeholder="Ej: 2"
              aria-invalid={Boolean(errors.ageValue)}
              aria-describedby={errors.ageValue ? "pub-age-error" : undefined}
              className="w-24 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              {...register("ageValue")}
            />
            <select
              id="pub-age-unit"
              aria-label="Unidad de la edad"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
              {...register("ageUnit")}
            >
              <option value="years">Años</option>
              <option value="months">Meses</option>
            </select>
          </div>
          {errors.ageValue ? (
            <p
              id="pub-age-error"
              role="alert"
              className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {errors.ageValue.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* Castración y Sociabilidad (arrancan sin opción marcada) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1.5 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300">
            Castración *
          </legend>
          <div className="flex gap-2">
            <label className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-800 transition-colors hover:border-orange-400 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:has-[:checked]:bg-orange-950/30">
              <input
                type="radio"
                value="true"
                className="accent-orange-600"
                {...register("isNeutered")}
              />
              <span>Castrado</span>
            </label>
            <label className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-800 transition-colors hover:border-orange-400 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:has-[:checked]:bg-orange-950/30">
              <input
                type="radio"
                value="false"
                className="accent-orange-600"
                {...register("isNeutered")}
              />
              <span>No Castrado</span>
            </label>
          </div>
          {errors.isNeutered ? (
            <p
              role="alert"
              className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {errors.isNeutered.message}
            </p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300">
            Sociabilidad *
          </legend>
          <div className="flex gap-2">
            <label className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-800 transition-colors hover:border-orange-400 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:has-[:checked]:bg-orange-950/30">
              <input
                type="radio"
                value="true"
                className="accent-orange-600"
                {...register("isSociable")}
              />
              <span>Sociable</span>
            </label>
            <label className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-800 transition-colors hover:border-orange-400 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:has-[:checked]:bg-orange-950/30">
              <input
                type="radio"
                value="false"
                className="accent-orange-600"
                {...register("isSociable")}
              />
              <span>Salvaje</span>
            </label>
          </div>
          {errors.isSociable ? (
            <p
              role="alert"
              className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {errors.isSociable.message}
            </p>
          ) : null}
        </fieldset>
      </div>

      {/* Convivencia (arrancan en "Sin evaluar") */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="pub-with-kids"
            className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
          >
            ¿Sociable con niños? *
          </label>
          <select
            id="pub-with-kids"
            className={SELECT_BASE_CLASS}
            {...register("goodWithChildren")}
          >
            <option value="not_evaluated">Sin evaluar</option>
            <option value="yes">Sí</option>
            <option value="no">No</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="pub-with-animals"
            className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
          >
            ¿Con otros animales? *
          </label>
          <select
            id="pub-with-animals"
            className={SELECT_BASE_CLASS}
            {...register("goodWithAnimals")}
          >
            <option value="not_evaluated">Sin evaluar</option>
            <option value="yes">Sí</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>

      {/* Casos Urgentes (sin vista previa de insignias: lo valida Staff) */}
      <div className="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/70 p-3.5 dark:border-rose-900 dark:bg-rose-950/20">
        <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-sm bg-rose-600 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-xs">
                🚨 Caso Urgente
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Marcar como Caso Urgente
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              El hogar de tránsito vence pronto o requiere atención prioritaria
            </p>
          </div>
          <input
            type="checkbox"
            id="pub-pet-urgent"
            className="h-5 w-5 shrink-0 rounded-sm border-slate-300 accent-rose-600 focus:ring-2 focus:ring-rose-500"
            {...register("isUrgentRequested")}
          />
        </label>
      </div>

      {/* Salud / Cuidados especiales */}
      <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/20">
        <label className="flex min-h-[44px] cursor-pointer items-start justify-between gap-3">
          <span>
            <span className="block text-xs font-bold text-slate-900 dark:text-white">
              Tiene un problema de salud o necesita cuidados especiales
            </span>
            <span className="block text-[11px] text-slate-600 dark:text-slate-400">
              Ej: medicación diaria, dieta especial, recuperación de una cirugía
            </span>
          </span>
          <input
            type="checkbox"
            id="pub-health-check"
            aria-controls="pub-health-text"
            checked={Boolean(hasSpecialCare)}
            onChange={handleSpecialCareToggle}
            className="mt-0.5 h-5 w-5 shrink-0 rounded-sm border-slate-300 accent-blue-600 focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label htmlFor="pub-health-text" className="sr-only">
          Contá qué problema de salud tiene o qué cuidados necesita
        </label>
        <textarea
          id="pub-health-text"
          rows={2}
          maxLength={PET_SPECIAL_CARE_MAX_LENGTH}
          disabled={!hasSpecialCare}
          aria-invalid={Boolean(errors.specialCare)}
          aria-describedby={
            errors.specialCare
              ? "pub-health-count pub-health-error"
              : "pub-health-count"
          }
          placeholder={
            hasSpecialCare
              ? "Contá qué tiene o qué cuidados necesita"
              : "Marcá la casilla para completar este campo"
          }
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-850"
          {...register("specialCare")}
        />
        <div className="flex items-start justify-between gap-2">
          <div>
            {errors.specialCare ? (
              <p
                id="pub-health-error"
                role="alert"
                className="text-xs font-semibold text-red-600 dark:text-red-400"
              >
                {errors.specialCare.message}
              </p>
            ) : null}
          </div>
          <p
            id="pub-health-count"
            className={`text-right text-[11px] ${
              specialCareLength >= PET_SPECIAL_CARE_MAX_LENGTH - 15
                ? "font-semibold text-orange-700 dark:text-orange-400"
                : "text-slate-600 dark:text-slate-400"
            }`}
            aria-live="polite"
          >
            {specialCareLength} / {PET_SPECIAL_CARE_MAX_LENGTH}
          </p>
        </div>
      </div>

      {/* Fotos de la Mascota */}
      {requirePhotos ? (
        <div>
          <label
            htmlFor="pub-photo-file"
            className="mb-1.5 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
          >
            Foto de la Mascota *
          </label>
          <div
            id="pub-dropzone"
            className={`relative rounded-2xl border-2 border-dashed bg-slate-50 p-4 text-center transition-colors hover:border-orange-500 dark:bg-slate-800 ${
              photoError
                ? "border-red-500 dark:border-red-500"
                : "border-slate-300 dark:border-slate-700"
            }`}
          >
            <input
              type="file"
              id="pub-photo-file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handlePhotoChange}
              aria-describedby={photoError ? "pub-photo-error" : undefined}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {selectedPhotos.length === 0 ? (
              <div id="pub-dropzone-empty" className="space-y-1">
                <span className="block text-2xl" aria-hidden="true">
                  📸
                </span>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Subir foto de la mascota
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  JPG, PNG o WEBP (hasta 5 MB, podés elegir varias)
                </p>
              </div>
            ) : (
              <div id="pub-dropzone-preview" className="space-y-2">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {selectedPhotos.length === 1
                    ? "✓ Foto lista para publicar"
                    : `✓ ${selectedPhotos.length} fotos listas para publicar`}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Tocá acá para agregar más fotos
                </p>
              </div>
            )}
          </div>

          {selectedPhotos.length > 0 ? (
            <ul
              aria-label="Fotos seleccionadas"
              className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4"
            >
              {selectedPhotos.map((item, index) => (
                <li
                  key={item.id}
                  className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="relative h-24 w-full">
                    <Image
                      src={item.previewUrl}
                      alt={`Previsualización de foto ${index + 1}: ${item.file.name}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(item.id)}
                    aria-label={`Quitar foto ${index + 1}`}
                    className="absolute top-1 right-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-900/75 text-xs font-bold text-white transition-colors hover:bg-red-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {photoError ? (
            <p
              id="pub-photo-error"
              role="alert"
              className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {photoError}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Teléfono de contacto (no se muestra en el catálogo) */}
      <div>
        <label
          htmlFor="pub-contact"
          className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
        >
          Teléfono de contacto *
        </label>
        <input
          id="pub-contact"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={PET_CONTACT_PHONE_MAX_LENGTH}
          placeholder="358 4123456"
          aria-invalid={Boolean(errors.contactPhone)}
          aria-describedby={
            errors.contactPhone
              ? "pub-contact-help pub-contact-error"
              : "pub-contact-help"
          }
          className={INPUT_BASE_CLASS}
          {...register("contactPhone")}
        />
        <p
          id="pub-contact-help"
          className="mt-1 text-[11px] text-slate-600 dark:text-slate-400"
        >
          Solo lo ve el equipo de voluntarios para revisar la publicación.
        </p>
        {errors.contactPhone ? (
          <p
            id="pub-contact-error"
            role="alert"
            className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
          >
            {errors.contactPhone.message}
          </p>
        ) : null}
      </div>

      {/* Historia y Comportamiento (Descripción) */}
      <div>
        <label
          htmlFor="pub-desc"
          className="mb-1 block text-xs font-bold text-slate-700 uppercase dark:text-slate-300"
        >
          Historia y Comportamiento *
        </label>
        <textarea
          id="pub-desc"
          rows={3}
          maxLength={PET_DESCRIPTION_MAX_LENGTH}
          placeholder="Contá su historia, cómo fue rescatado y su relación con otros animales o niños..."
          aria-invalid={Boolean(errors.description)}
          aria-describedby={
            errors.description
              ? "pub-desc-count pub-desc-error"
              : "pub-desc-count"
          }
          className={INPUT_BASE_CLASS}
          {...register("description")}
        />
        <div className="mt-1 flex items-start justify-between gap-2">
          <div>
            {errors.description ? (
              <p
                id="pub-desc-error"
                role="alert"
                className="text-xs font-semibold text-red-600 dark:text-red-400"
              >
                {errors.description.message}
              </p>
            ) : null}
          </div>
          <p
            id="pub-desc-count"
            className={`text-right text-[11px] ${
              descriptionLength >= PET_DESCRIPTION_MAX_LENGTH - 40
                ? "font-semibold text-orange-700 dark:text-orange-400"
                : "text-slate-600 dark:text-slate-400"
            }`}
            aria-live="polite"
          >
            {descriptionLength} / {PET_DESCRIPTION_MAX_LENGTH}
          </p>
        </div>
      </div>

      {helperNote ? (
        <p className="text-center text-[11px] text-slate-600 dark:text-slate-400">
          {helperNote}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-[44px] w-full rounded-2xl bg-orange-700 py-3.5 font-display text-sm font-bold text-white shadow-md transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}

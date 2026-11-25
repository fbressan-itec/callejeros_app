import { z } from "zod";

import type { PetCompatibility, PetSex, PetSpecies } from "@/lib/pets/types";

export const PET_NAME_MAX_LENGTH = 100;
export const PET_DESCRIPTION_MAX_LENGTH = 400;
export const PET_SPECIAL_CARE_MAX_LENGTH = 150;
export const PET_CONTACT_PHONE_MAX_LENGTH = 30;
export const PET_AGE_MIN = 1;
export const PET_AGE_MAX = 30;
export const PET_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PET_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_PET_PHOTO_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export const PET_PHOTO_REQUIRED_ERROR =
  "Subí una foto de la mascota: es obligatoria para publicarla.";
export const PET_PHOTO_FORMAT_ERROR =
  "Formato de imagen no permitido. Usá JPG, PNG o WEBP.";
export const PET_PHOTO_SIZE_ERROR = "Cada foto puede pesar como máximo 5 MB.";

export type PetAgeUnit = "years" | "months";
export type TriBooleanOption = "" | "true" | "false";

export interface PetFormValues {
  name: string;
  species: PetSpecies;
  sex: PetSex;
  ageValue: string;
  ageUnit: PetAgeUnit;
  isNeutered: TriBooleanOption;
  isSociable: TriBooleanOption;
  goodWithChildren: PetCompatibility;
  goodWithAnimals: PetCompatibility;
  isUrgentRequested: boolean;
  hasSpecialCare: boolean;
  specialCare: string;
  contactPhone: string;
  description: string;
}

/**
 * Valores iniciales del formulario de publicación.
 * Castración y sociabilidad arrancan sin opción marcada (`""`) y convivencia en `"not_evaluated"`,
 * como exige `03-reglas-de-negocio.md` y el maquetado `adopciones.html`.
 */
export const DEFAULT_PET_FORM_VALUES: PetFormValues = {
  name: "",
  species: "dog",
  sex: "male",
  ageValue: "",
  ageUnit: "years",
  isNeutered: "",
  isSociable: "",
  goodWithChildren: "not_evaluated",
  goodWithAnimals: "not_evaluated",
  isUrgentRequested: false,
  hasSpecialCare: false,
  specialCare: "",
  contactPhone: "",
  description: "",
};

export const petFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre de la mascota es obligatorio.")
      .max(
        PET_NAME_MAX_LENGTH,
        `El nombre no puede superar los ${PET_NAME_MAX_LENGTH} caracteres.`,
      ),
    species: z.enum(["dog", "cat"]),
    sex: z.enum(["male", "female"]),
    ageValue: z
      .string()
      .trim()
      .min(1, "Indicá la edad aproximada.")
      .refine((value) => /^\d+$/.test(value), {
        message: "Ingresá un número entero válido.",
      })
      .refine(
        (value) => {
          const parsed = Number.parseInt(value, 10);
          return parsed >= PET_AGE_MIN && parsed <= PET_AGE_MAX;
        },
        {
          message: `La edad debe estar entre ${PET_AGE_MIN} y ${PET_AGE_MAX}.`,
        },
      ),
    ageUnit: z.enum(["years", "months"]),
    isNeutered: z.custom<TriBooleanOption>(
      (value) => value === "true" || value === "false",
      {
        message: "Indicá si la mascota está castrada.",
      },
    ),
    isSociable: z.custom<TriBooleanOption>(
      (value) => value === "true" || value === "false",
      {
        message: "Indicá si la mascota es sociable.",
      },
    ),
    goodWithChildren: z.enum(["not_evaluated", "yes", "no"]),
    goodWithAnimals: z.enum(["not_evaluated", "yes", "no"]),
    isUrgentRequested: z.boolean(),
    hasSpecialCare: z.boolean(),
    specialCare: z
      .string()
      .trim()
      .max(
        PET_SPECIAL_CARE_MAX_LENGTH,
        `El cuidado especial no puede superar los ${PET_SPECIAL_CARE_MAX_LENGTH} caracteres.`,
      ),
    contactPhone: z
      .string()
      .trim()
      .min(1, "El teléfono de contacto es obligatorio.")
      .max(
        PET_CONTACT_PHONE_MAX_LENGTH,
        `El teléfono no puede superar los ${PET_CONTACT_PHONE_MAX_LENGTH} caracteres.`,
      ),
    description: z
      .string()
      .trim()
      .min(1, "La descripción es obligatoria.")
      .max(
        PET_DESCRIPTION_MAX_LENGTH,
        `La descripción no puede superar los ${PET_DESCRIPTION_MAX_LENGTH} caracteres.`,
      ),
  })
  .superRefine((data, ctx) => {
    if (data.hasSpecialCare && data.specialCare.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["specialCare"],
        message: "Contá qué problema de salud tiene o qué cuidados necesita.",
      });
    }
  });

function formatIsoDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Calcula `estimated_birth_date` (YYYY-MM-DD) restando años o meses a `referenceDate`,
 * ajustando al último día válido del mes si corresponde (ej. 29 de febrero).
 */
export function computeEstimatedBirthDate(
  ageValue: number,
  ageUnit: PetAgeUnit,
  referenceDate: Date = new Date(),
): string {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  let targetYear = refYear;
  let targetMonth = refMonth;

  if (ageUnit === "years") {
    targetYear = refYear - ageValue;
  } else {
    const totalMonths = refYear * 12 + refMonth - ageValue;
    targetYear = Math.floor(totalMonths / 12);
    targetMonth = ((totalMonths % 12) + 12) % 12;
  }

  const lastDayOfTargetMonth = new Date(
    targetYear,
    targetMonth + 1,
    0,
  ).getDate();
  const targetDay = Math.min(refDay, lastDayOfTargetMonth);

  return formatIsoDate(targetYear, targetMonth, targetDay);
}

/**
 * Valida un archivo de imagen antes de subirlo: JPG, PNG o WEBP de hasta 5 MB.
 * Devuelve el mensaje de error o `null` si es válido.
 */
export function validatePetPhotoFile(file: File): string | null {
  const hasAllowedMime = file.type
    ? ALLOWED_PET_PHOTO_MIME_TYPES.has(file.type.toLowerCase())
    : ALLOWED_PET_PHOTO_EXTENSIONS.test(file.name);

  if (!hasAllowedMime) {
    return PET_PHOTO_FORMAT_ERROR;
  }

  if (file.size > PET_PHOTO_MAX_BYTES) {
    return PET_PHOTO_SIZE_ERROR;
  }

  return null;
}

/**
 * Construye el `FormData` para `POST /api/pets/` según `PetCreateSerializer`.
 */
export function buildCreatePetFormData(
  values: PetFormValues,
  photos: readonly File[],
  referenceDate: Date = new Date(),
): FormData {
  const formData = new FormData();
  const ageNumber = Number.parseInt(values.ageValue.trim(), 10);
  const estimatedBirthDate = computeEstimatedBirthDate(
    ageNumber,
    values.ageUnit,
    referenceDate,
  );

  formData.append("name", values.name.trim());
  formData.append("species", values.species);
  formData.append("sex", values.sex);
  formData.append("estimated_birth_date", estimatedBirthDate);
  formData.append("is_neutered", values.isNeutered);
  formData.append("is_sociable", values.isSociable);
  formData.append("good_with_children", values.goodWithChildren);
  formData.append("good_with_animals", values.goodWithAnimals);
  formData.append("is_urgent_requested", String(values.isUrgentRequested));
  formData.append(
    "special_care",
    values.hasSpecialCare ? values.specialCare.trim() : "",
  );
  formData.append("contact_phone", values.contactPhone.trim());
  formData.append("description", values.description.trim());

  for (const photo of photos) {
    formData.append("photos", photo);
  }

  return formData;
}

import { z } from "zod";

/**
 * Cuestionario de adopción de 4 bloques (`producto/03-reglas-de-negocio.md`, "Solicitud de
 * adopción"). Los mensajes son los mismos que devuelve el back
 * (`backend/apps/adoptions/services.py`), así la persona lee lo mismo en las dos capas.
 */

export const MIN_APPLICANT_AGE = 18;
export const MAX_APPLICANT_AGE = 120;
export const MAX_OPEN_ANSWER_LENGTH = 500;
export const MAX_ADOPTION_REASON_LENGTH = 1000;

export const QUESTIONNAIRE_STEP_COUNT = 4;
export type QuestionnaireStep = 1 | 2 | 3 | 4;

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export const HOME_OWNERSHIP_OPTIONS = [
  { value: "owned", label: "Propia" },
  { value: "rented", label: "Alquilada" },
  { value: "other", label: "Otra" },
] as const satisfies readonly ChoiceOption<string>[];

export const RENTAL_PETS_POLICY_OPTIONS = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
  { value: "unknown", label: "No sé" },
] as const satisfies readonly ChoiceOption<string>[];

export const HOUSEHOLD_AGREEMENT_OPTIONS = [
  { value: "yes", label: "Sí" },
  { value: "not_discussed", label: "Todavía no lo hablamos" },
] as const satisfies readonly ChoiceOption<string>[];

export const HOURS_ALONE_OPTIONS = [
  { value: "less_than_4", label: "Menos de 4" },
  { value: "4_to_8", label: "4 a 8" },
  { value: "more_than_8", label: "Más de 8" },
] as const satisfies readonly ChoiceOption<string>[];

export type HomeOwnership = (typeof HOME_OWNERSHIP_OPTIONS)[number]["value"];
export type RentalPetsPolicy =
  (typeof RENTAL_PETS_POLICY_OPTIONS)[number]["value"];
export type HouseholdAgreement =
  (typeof HOUSEHOLD_AGREEMENT_OPTIONS)[number]["value"];
export type HoursAlone = (typeof HOURS_ALONE_OPTIONS)[number]["value"];

export const QUESTIONNAIRE_MESSAGES = {
  ageRequired: "La edad es obligatoria.",
  ageInvalid: "Ingresá tu edad en números.",
  minAge: `Para adoptar tenés que ser mayor de ${MIN_APPLICANT_AGE} años.`,
  maxAge: `La edad no puede superar los ${MAX_APPLICANT_AGE} años.`,
  emailInvalid: "Ingresá un correo electrónico válido.",
  rentalRequired: "Indicá si el contrato o el dueño permite animales.",
  tooLong: (max: number) =>
    `Este campo no puede superar los ${max} caracteres.`,
} as const;

function requiredText(message: string, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, message)
    .max(maxLength, QUESTIONNAIRE_MESSAGES.tooLong(maxLength));
}

function requiredChoice(
  options: readonly ChoiceOption<string>[],
  message: string,
) {
  const values = options.map((option) => option.value);
  return z.string().refine((value) => values.includes(value), message);
}

function requiredCheckbox(message: string) {
  return z.boolean().refine((value) => value === true, message);
}

const personalShape = {
  full_name: requiredText("El nombre completo es obligatorio.", 200),
  age: z
    .string()
    .trim()
    .min(1, QUESTIONNAIRE_MESSAGES.ageRequired)
    .refine(
      (value) => value === "" || /^\d+$/.test(value),
      QUESTIONNAIRE_MESSAGES.ageInvalid,
    )
    .refine(
      (value) => !/^\d+$/.test(value) || Number(value) >= MIN_APPLICANT_AGE,
      QUESTIONNAIRE_MESSAGES.minAge,
    )
    .refine(
      (value) => !/^\d+$/.test(value) || Number(value) <= MAX_APPLICANT_AGE,
      QUESTIONNAIRE_MESSAGES.maxAge,
    ),
  phone: requiredText("El WhatsApp o teléfono es obligatorio.", 30),
  email: z
    .string()
    .trim()
    .min(1, "El correo electrónico es obligatorio.")
    .max(254, QUESTIONNAIRE_MESSAGES.tooLong(254))
    .email(QUESTIONNAIRE_MESSAGES.emailInvalid),
  address: requiredText("La dirección es obligatoria.", 255),
  city: requiredText("La localidad es obligatoria.", 100),
};

const homeShape = {
  housing_type: requiredText("El tipo de vivienda es obligatorio.", 200),
  home_ownership: requiredChoice(
    HOME_OWNERSHIP_OPTIONS,
    "Indicá si la vivienda es propia, alquilada u otra.",
  ),
  // Obligatoria solo si es alquilada: la regla está en `withRentalRule`
  rental_allows_pets: z.string(),
  outdoor_space: requiredText(
    "Contanos cómo es el patio, balcón o terraza y qué protecciones tiene.",
    MAX_OPEN_ANSWER_LENGTH,
  ),
  household_members: requiredText(
    "Contanos quiénes viven con vos.",
    MAX_OPEN_ANSWER_LENGTH,
  ),
  household_agreement: requiredChoice(
    HOUSEHOLD_AGREEMENT_OPTIONS,
    "Indicá si todos en tu casa están de acuerdo con la adopción.",
  ),
  other_pets: requiredText("Indicá si tenés otros animales actualmente.", 255),
};

const routineShape = {
  previous_pets: requiredText(
    "Contanos si tuviste animales antes y qué pasó con ellos.",
    MAX_OPEN_ANSWER_LENGTH,
  ),
  hours_alone: requiredChoice(
    HOURS_ALONE_OPTIONS,
    "Indicá cuántas horas por día pasaría solo/a.",
  ),
  living_space: requiredText(
    "Contanos dónde va a dormir y pasar el día.",
    MAX_OPEN_ANSWER_LENGTH,
  ),
  vacation_care: requiredText(
    "Contanos quién lo cuida si viajás o te vas de vacaciones.",
    MAX_OPEN_ANSWER_LENGTH,
  ),
  contingency_plan: requiredText(
    "Contanos qué harías si te mudás o no podés seguir cuidándolo.",
    MAX_OPEN_ANSWER_LENGTH,
  ),
  adoption_reason: z
    .string()
    .trim()
    .max(
      MAX_ADOPTION_REASON_LENGTH,
      QUESTIONNAIRE_MESSAGES.tooLong(MAX_ADOPTION_REASON_LENGTH),
    ),
};

function commitmentShape(requiresNeutering: boolean) {
  return {
    accepts_commitment: requiredCheckbox(
      "Tenés que aceptar el compromiso de adopción responsable para enviar la solicitud.",
    ),
    // Se pide solo si la mascota no está castrada
    accepts_neutering: requiresNeutering
      ? requiredCheckbox(
          "Tenés que comprometerte a castrarlo/a para enviar la solicitud.",
        )
      : z.boolean(),
    accepts_follow_up: requiredCheckbox(
      "Tenés que aceptar el seguimiento después de la adopción para enviar la solicitud.",
    ),
    accepts_return_notice: requiredCheckbox(
      "Tenés que comprometerte a avisar a Callejeros antes de darlo a otra persona.",
    ),
    declares_truthful: requiredCheckbox(
      "Tenés que declarar que los datos son verdaderos para enviar la solicitud.",
    ),
  };
}

function buildFullObject(requiresNeutering: boolean) {
  return z.object({
    ...personalShape,
    ...homeShape,
    ...routineShape,
    ...commitmentShape(requiresNeutering),
  });
}

export type AdoptionQuestionnaireValues = z.infer<
  ReturnType<typeof buildFullObject>
>;

/** Campos de cada paso, en el orden en que aparecen (para validar y para ubicar errores). */
export const QUESTIONNAIRE_STEP_FIELDS: Record<
  QuestionnaireStep,
  readonly (keyof AdoptionQuestionnaireValues)[]
> = {
  1: ["full_name", "age", "phone", "email", "address", "city"],
  2: [
    "housing_type",
    "home_ownership",
    "rental_allows_pets",
    "outdoor_space",
    "household_members",
    "household_agreement",
    "other_pets",
  ],
  3: [
    "previous_pets",
    "hours_alone",
    "living_space",
    "vacation_care",
    "contingency_plan",
    "adoption_reason",
  ],
  4: [
    "accepts_commitment",
    "accepts_neutering",
    "accepts_follow_up",
    "accepts_return_notice",
    "declares_truthful",
  ],
};

export const QUESTIONNAIRE_STEP_TITLES: Record<QuestionnaireStep, string> = {
  1: "1. Datos Personales",
  2: "2. Hogar y Entorno",
  3: "3. Experiencia y Rutina",
  4: "4. Compromiso",
};

/**
 * Esquema de un paso (para validar antes de avanzar) o de todo el cuestionario (al enviar).
 * La pregunta del alquiler se exige aunque otros campos del paso tengan errores, para que
 * la persona vea todos los avisos juntos.
 */
export function buildQuestionnaireSchema(
  requiresNeutering: boolean,
  step: QuestionnaireStep | "all" = "all",
): z.ZodType {
  if (step === 1) return z.object(personalShape);
  if (step === 3) return z.object(routineShape);
  if (step === 4) return z.object(commitmentShape(requiresNeutering));
  if (step === 2) return withRentalRule(z.object(homeShape));
  return withRentalRule(buildFullObject(requiresNeutering));
}

function withRentalRule<
  T extends z.ZodType<{ home_ownership: string; rental_allows_pets: string }>,
>(schema: T) {
  return schema.refine(
    (values) =>
      values.home_ownership !== "rented" ||
      RENTAL_PETS_POLICY_OPTIONS.some(
        (option) => option.value === values.rental_allows_pets,
      ),
    {
      message: QUESTIONNAIRE_MESSAGES.rentalRequired,
      path: ["rental_allows_pets"],
      when: () => true,
    },
  );
}

export interface QuestionnairePrefill {
  fullName?: string;
  email?: string;
}

/** Valores iniciales: nombre y correo de la cuenta (editables); el resto vacío. */
export function getQuestionnaireDefaultValues(
  prefill: QuestionnairePrefill = {},
): AdoptionQuestionnaireValues {
  return {
    full_name: prefill.fullName ?? "",
    age: "",
    phone: "",
    email: prefill.email ?? "",
    address: "",
    city: "",
    housing_type: "",
    home_ownership: "",
    rental_allows_pets: "",
    outdoor_space: "",
    household_members: "",
    household_agreement: "",
    other_pets: "",
    previous_pets: "",
    hours_alone: "",
    living_space: "",
    vacation_care: "",
    contingency_plan: "",
    adoption_reason: "",
    accepts_commitment: false,
    accepts_neutering: false,
    accepts_follow_up: false,
    accepts_return_notice: false,
    declares_truthful: false,
  };
}

/** Cuerpo de `POST /api/adoption-requests/`. */
export interface AdoptionRequestPayload {
  pet: number;
  full_name: string;
  age: number;
  phone: string;
  email: string;
  address: string;
  city: string;
  housing_type: string;
  home_ownership: string;
  rental_allows_pets: string;
  outdoor_space: string;
  household_members: string;
  household_agreement: string;
  other_pets: string;
  previous_pets: string;
  hours_alone: string;
  living_space: string;
  vacation_care: string;
  contingency_plan: string;
  adoption_reason: string;
  accepts_commitment: boolean;
  accepts_neutering: boolean | null;
  accepts_follow_up: boolean;
  accepts_return_notice: boolean;
  declares_truthful: boolean;
}

export function toAdoptionRequestPayload(
  petId: number,
  values: AdoptionQuestionnaireValues,
  requiresNeutering: boolean,
): AdoptionRequestPayload {
  const text = (value: string) => value.trim();
  return {
    pet: petId,
    full_name: text(values.full_name),
    age: Number(values.age.trim()),
    phone: text(values.phone),
    email: text(values.email),
    address: text(values.address),
    city: text(values.city),
    housing_type: text(values.housing_type),
    home_ownership: values.home_ownership,
    rental_allows_pets:
      values.home_ownership === "rented" ? values.rental_allows_pets : "",
    outdoor_space: text(values.outdoor_space),
    household_members: text(values.household_members),
    household_agreement: values.household_agreement,
    other_pets: text(values.other_pets),
    previous_pets: text(values.previous_pets),
    hours_alone: values.hours_alone,
    living_space: text(values.living_space),
    vacation_care: text(values.vacation_care),
    contingency_plan: text(values.contingency_plan),
    adoption_reason: text(values.adoption_reason),
    accepts_commitment: values.accepts_commitment,
    accepts_neutering: requiresNeutering ? values.accepts_neutering : null,
    accepts_follow_up: values.accepts_follow_up,
    accepts_return_notice: values.accepts_return_notice,
    declares_truthful: values.declares_truthful,
  };
}

/** Primer paso que tiene alguno de estos campos con error (para llevar a la persona ahí). */
export function getFirstStepWithError(
  fieldNames: readonly string[],
): QuestionnaireStep | null {
  for (const step of [1, 2, 3, 4] as const) {
    if (
      QUESTIONNAIRE_STEP_FIELDS[step].some((field) =>
        fieldNames.includes(field),
      )
    ) {
      return step;
    }
  }
  return null;
}

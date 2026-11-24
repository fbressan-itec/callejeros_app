import { z } from "zod";

import {
  type ChoiceOption,
  HOME_OWNERSHIP_OPTIONS,
  HOURS_ALONE_OPTIONS,
  HOUSEHOLD_AGREEMENT_OPTIONS,
  QUESTIONNAIRE_STEP_TITLES,
  type QuestionnaireStep,
  RENTAL_PETS_POLICY_OPTIONS,
} from "@/lib/adoptions/questionnaire";
import type { AdoptionRequestReview } from "@/lib/adoptions/types";
import { getActionErrorMessage } from "@/lib/api/errors";

/**
 * Revisión de solicitudes de adopción en el panel de Staff (`producto/03-reglas-de-negocio.md`,
 * "Solicitud de adopción"). Los mensajes del motivo son los mismos que devuelve el back
 * (`backend/apps/adoptions/services.py`).
 */

export const MAX_REJECTION_REASON_LENGTH = 400;

export const REJECTION_REASON_MESSAGES = {
  required: "Indicá el motivo de desaprobación para responder al solicitante.",
  tooLong: `El motivo de desaprobación no puede superar los ${MAX_REJECTION_REASON_LENGTH} caracteres.`,
} as const;

export const rejectAdoptionRequestSchema = z.object({
  rejection_reason: z
    .string()
    .trim()
    .min(1, REJECTION_REASON_MESSAGES.required)
    .max(MAX_REJECTION_REASON_LENGTH, REJECTION_REASON_MESSAGES.tooLong),
});

export type RejectAdoptionRequestValues = z.infer<
  typeof rejectAdoptionRequestSchema
>;

/** Lo que se muestra cuando una respuesta opcional quedó vacía. */
export const EMPTY_ANSWER = "—";

export interface QuestionnaireAnswer {
  label: string;
  value: string;
}

export interface QuestionnaireAnswerSection {
  step: QuestionnaireStep;
  title: string;
  answers: QuestionnaireAnswer[];
}

function getChoiceLabel(
  options: readonly ChoiceOption<string>[],
  value: string,
): string {
  return (
    options.find((option) => option.value === value)?.label ?? EMPTY_ANSWER
  );
}

function text(value: string): string {
  return value.trim() || EMPTY_ANSWER;
}

function commitment(value: boolean): string {
  return value ? "✅ Aceptado" : "❌ No aceptado";
}

/** Nombre del solicitante: el que declaró en el cuestionario o, si falta, el de la cuenta. */
export function getApplicantName(request: AdoptionRequestReview): string {
  const declared = request.full_name.trim();
  if (declared) return declared;
  const account = [request.applicant.first_name, request.applicant.last_name]
    .join(" ")
    .trim();
  return account || "el solicitante";
}

/**
 * Respuestas del cuestionario en los 4 bloques, con las mismas preguntas que ve el
 * solicitante. La pregunta del alquiler aparece solo si la vivienda es alquilada y la de
 * castración solo si se le pidió (`accepts_neutering` no es `null`).
 */
export function buildQuestionnaireAnswerSections(
  request: AdoptionRequestReview,
): QuestionnaireAnswerSection[] {
  const home: QuestionnaireAnswer[] = [
    { label: "Tipo de Vivienda", value: text(request.housing_type) },
    {
      label: "La vivienda es…",
      value: getChoiceLabel(HOME_OWNERSHIP_OPTIONS, request.home_ownership),
    },
  ];
  if (request.home_ownership === "rented") {
    home.push({
      label: "¿El contrato o el dueño permite animales?",
      value: getChoiceLabel(
        RENTAL_PETS_POLICY_OPTIONS,
        request.rental_allows_pets,
      ),
    });
  }
  home.push(
    {
      label:
        "¿Cómo es el patio, balcón o terraza, y qué protecciones tiene (cerco, red en ventanas)?",
      value: text(request.outdoor_space),
    },
    {
      label: "¿Quiénes viven con vos?",
      value: text(request.household_members),
    },
    {
      label: "¿Todos en tu casa están de acuerdo con la adopción?",
      value: getChoiceLabel(
        HOUSEHOLD_AGREEMENT_OPTIONS,
        request.household_agreement,
      ),
    },
    {
      label: "¿Tenés otros animales actualmente?",
      value: text(request.other_pets),
    },
  );

  const commitments: QuestionnaireAnswer[] = [
    {
      label: "Alimentación, veterinaria, vacunas y no abandonarlo",
      value: commitment(request.accepts_commitment),
    },
  ];
  if (request.accepts_neutering !== null) {
    commitments.push({
      label: "Castrarlo/a cuando tenga la edad indicada",
      value: commitment(request.accepts_neutering),
    });
  }
  commitments.push(
    {
      label: "Seguimiento después de la adopción",
      value: commitment(request.accepts_follow_up),
    },
    {
      label: "Avisar a Callejeros antes de darlo a otra persona",
      value: commitment(request.accepts_return_notice),
    },
    {
      label: "Declara que los datos son verdaderos",
      value: commitment(request.declares_truthful),
    },
  );

  return [
    {
      step: 1,
      title: QUESTIONNAIRE_STEP_TITLES[1],
      answers: [
        { label: "Nombre Completo", value: text(request.full_name) },
        { label: "Edad", value: `${request.age} años` },
        { label: "WhatsApp / Teléfono", value: text(request.phone) },
        { label: "Correo Electrónico", value: text(request.email) },
        { label: "Dirección", value: text(request.address) },
        { label: "Localidad", value: text(request.city) },
      ],
    },
    { step: 2, title: QUESTIONNAIRE_STEP_TITLES[2], answers: home },
    {
      step: 3,
      title: QUESTIONNAIRE_STEP_TITLES[3],
      answers: [
        {
          label: "¿Tuviste animales antes? ¿Qué pasó con ellos?",
          value: text(request.previous_pets),
        },
        {
          label: "¿Cuántas horas por día pasaría solo/a?",
          value: getChoiceLabel(HOURS_ALONE_OPTIONS, request.hours_alone),
        },
        {
          label: "¿Dónde va a dormir y pasar el día?",
          value: text(request.living_space),
        },
        {
          label: "¿Quién lo cuida si viajás o te vas de vacaciones?",
          value: text(request.vacation_care),
        },
        {
          label: "¿Qué harías si te mudás o no podés seguir cuidándolo?",
          value: text(request.contingency_plan),
        },
        {
          label: `¿Por qué querés adoptar a ${request.pet.name}?`,
          value: text(request.adoption_reason),
        },
      ],
    },
    { step: 4, title: QUESTIONNAIRE_STEP_TITLES[4], answers: commitments },
  ];
}

/**
 * Mensaje para mostrar cuando falla aprobar o desaprobar: el del back si explica el motivo
 * (la solicitud ya no está pendiente, la mascota ya no está disponible) o el general.
 */
export function getReviewErrorMessage(error: unknown): string {
  // El error del motivo se muestra junto al campo, no como aviso general
  return getActionErrorMessage(error, ["rejection_reason"]);
}

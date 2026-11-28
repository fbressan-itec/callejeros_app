import { describe, expect, it } from "vitest";

import {
  buildQuestionnaireAnswerSections,
  EMPTY_ANSWER,
  getApplicantName,
  getReviewErrorMessage,
  MAX_REJECTION_REASON_LENGTH,
  REJECTION_REASON_MESSAGES,
  rejectAdoptionRequestSchema,
} from "@/lib/adoptions/review";
import { buildAdoptionRequestReview } from "@/lib/adoptions/testing";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";

function findAnswer(
  sections: ReturnType<typeof buildQuestionnaireAnswerSections>,
  label: string,
) {
  return sections
    .flatMap((section) => section.answers)
    .find((answer) => answer.label === label);
}

describe("lib/adoptions/review", () => {
  it("arma los 4 bloques con los títulos del cuestionario", () => {
    const sections = buildQuestionnaireAnswerSections(
      buildAdoptionRequestReview(),
    );

    expect(sections.map((section) => section.title)).toEqual([
      "1. Datos Personales",
      "2. Hogar y Entorno",
      "3. Experiencia y Rutina",
      "4. Compromiso",
    ]);
    expect(findAnswer(sections, "Edad")?.value).toBe("29 años");
    expect(findAnswer(sections, "La vivienda es…")?.value).toBe("Propia");
    expect(
      findAnswer(sections, "¿Cuántas horas por día pasaría solo/a?")?.value,
    ).toBe("4 a 8");
  });

  it("muestra la pregunta del alquiler solo si la vivienda es alquilada", () => {
    const owned = buildQuestionnaireAnswerSections(
      buildAdoptionRequestReview(),
    );
    const rented = buildQuestionnaireAnswerSections(
      buildAdoptionRequestReview({
        home_ownership: "rented",
        rental_allows_pets: "unknown",
      }),
    );
    const label = "¿El contrato o el dueño permite animales?";

    expect(findAnswer(owned, label)).toBeUndefined();
    expect(findAnswer(rented, label)?.value).toBe("No sé");
  });

  it("muestra el compromiso de castración solo si se le pidió", () => {
    const label = "Castrarlo/a cuando tenga la edad indicada";
    const notAsked = buildQuestionnaireAnswerSections(
      buildAdoptionRequestReview({ accepts_neutering: null }),
    );
    const asked = buildQuestionnaireAnswerSections(
      buildAdoptionRequestReview({ accepts_neutering: true }),
    );

    expect(findAnswer(notAsked, label)).toBeUndefined();
    expect(findAnswer(asked, label)?.value).toBe("✅ Aceptado");
  });

  it("usa un guion para las respuestas vacías y el nombre de la mascota en el motivo", () => {
    const sections = buildQuestionnaireAnswerSections(
      buildAdoptionRequestReview({ adoption_reason: "  " }),
    );

    expect(findAnswer(sections, "¿Por qué querés adoptar a Loki?")?.value).toBe(
      EMPTY_ANSWER,
    );
  });

  it("usa el nombre declarado y, si falta, el de la cuenta", () => {
    expect(getApplicantName(buildAdoptionRequestReview())).toBe("Sofía Gómez");
    expect(
      getApplicantName(
        buildAdoptionRequestReview({
          full_name: " ",
          applicant: {
            id: 5,
            first_name: "Ana",
            last_name: "Paz",
            role: { code: "member", name: "Miembro" },
          },
        }),
      ),
    ).toBe("Ana Paz");
  });

  it("exige el motivo de desaprobación con el límite del back", () => {
    const empty = rejectAdoptionRequestSchema.safeParse({
      rejection_reason: "   ",
    });
    const tooLong = rejectAdoptionRequestSchema.safeParse({
      rejection_reason: "a".repeat(MAX_REJECTION_REASON_LENGTH + 1),
    });
    const valid = rejectAdoptionRequestSchema.safeParse({
      rejection_reason: "  No tiene patio cerrado.  ",
    });

    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.message).toBe(
      REJECTION_REASON_MESSAGES.required,
    );
    expect(tooLong.error?.issues[0]?.message).toBe(
      REJECTION_REASON_MESSAGES.tooLong,
    );
    expect(valid.data?.rejection_reason).toBe("No tiene patio cerrado.");
  });

  it("prioriza el motivo del back al fallar la revisión", () => {
    expect(
      getReviewErrorMessage(
        new ApiError(400, ERROR_MESSAGES.validation, {
          pet: ["Esta mascota ya no está disponible para adopción."],
        }),
      ),
    ).toBe("Esta mascota ya no está disponible para adopción.");
    expect(
      getReviewErrorMessage(
        new ApiError(400, ERROR_MESSAGES.validation, {
          rejection_reason: ["Indicá el motivo."],
        }),
      ),
    ).toBe(ERROR_MESSAGES.validation);
    expect(getReviewErrorMessage(new Error("x"))).toBe(ERROR_MESSAGES.unknown);
  });
});

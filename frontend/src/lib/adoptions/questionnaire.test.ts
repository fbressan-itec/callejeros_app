import { describe, expect, it } from "vitest";

import {
  type AdoptionQuestionnaireValues,
  buildQuestionnaireSchema,
  getFirstStepWithError,
  getQuestionnaireDefaultValues,
  toAdoptionRequestPayload,
} from "@/lib/adoptions/questionnaire";

const COMPLETE: AdoptionQuestionnaireValues = {
  full_name: " Tomás Gómez ",
  age: "32",
  phone: "358 4111111",
  email: "miembro@callejeros.ar",
  address: "Sobremonte 100",
  city: "Río Cuarto",
  housing_type: "Casa con patio",
  home_ownership: "owned",
  rental_allows_pets: "",
  outdoor_space: "Patio con cerco alto",
  household_members: "Dos adultos",
  household_agreement: "yes",
  other_pets: "Una gata castrada",
  previous_pets: "Un perro que vivió 15 años",
  hours_alone: "4_to_8",
  living_space: "Adentro de la casa",
  vacation_care: "Mi hermana",
  contingency_plan: "Me lo llevo conmigo",
  adoption_reason: "",
  accepts_commitment: true,
  accepts_neutering: false,
  accepts_follow_up: true,
  accepts_return_notice: true,
  declares_truthful: true,
};

function issuesOf(
  values: Partial<AdoptionQuestionnaireValues>,
  options: {
    requiresNeutering?: boolean;
    step?: 1 | 2 | 3 | 4 | "all";
  } = {},
) {
  const result = buildQuestionnaireSchema(
    options.requiresNeutering ?? false,
    options.step ?? "all",
  ).safeParse({ ...COMPLETE, ...values });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("cuestionario de adopción", () => {
  it("acepta un cuestionario completo", () => {
    expect(issuesOf({})).toEqual({});
  });

  it("precarga nombre y correo y deja el resto vacío", () => {
    const values = getQuestionnaireDefaultValues({
      fullName: "Tomás Gómez",
      email: "miembro@callejeros.ar",
    });
    expect(values.full_name).toBe("Tomás Gómez");
    expect(values.email).toBe("miembro@callejeros.ar");
    expect(values.age).toBe("");
    expect(values.accepts_commitment).toBe(false);
  });

  it("valida la edad entre 18 y 120 con los mensajes del back", () => {
    expect(issuesOf({ age: "" }, { step: 1 }).age).toBe(
      "La edad es obligatoria.",
    );
    expect(issuesOf({ age: "17" }, { step: 1 }).age).toBe(
      "Para adoptar tenés que ser mayor de 18 años.",
    );
    expect(issuesOf({ age: "121" }, { step: 1 }).age).toBe(
      "La edad no puede superar los 120 años.",
    );
    expect(issuesOf({ age: "treinta" }, { step: 1 }).age).toBe(
      "Ingresá tu edad en números.",
    );
    expect(issuesOf({ age: "18" }, { step: 1 })).toEqual({});
  });

  it("pide los textos obligatorios y un correo válido", () => {
    const issues = issuesOf(
      { full_name: "  ", email: "no-es-correo", city: "" },
      { step: 1 },
    );
    expect(issues.full_name).toBe("El nombre completo es obligatorio.");
    expect(issues.email).toBe("Ingresá un correo electrónico válido.");
    expect(issues.city).toBe("La localidad es obligatoria.");
  });

  it("valida solo los campos del paso pedido", () => {
    expect(issuesOf({ full_name: "" }, { step: 2 })).toEqual({});
    expect(issuesOf({ housing_type: "" }, { step: 1 })).toEqual({});
  });

  it("exige la respuesta del alquiler solo si la vivienda es alquilada, aunque haya otros errores", () => {
    expect(
      issuesOf(
        { home_ownership: "rented", rental_allows_pets: "" },
        { step: 2 },
      ).rental_allows_pets,
    ).toBe("Indicá si el contrato o el dueño permite animales.");

    const withOtherErrors = issuesOf(
      { home_ownership: "rented", rental_allows_pets: "", housing_type: "" },
      { step: 2 },
    );
    expect(withOtherErrors.rental_allows_pets).toBeDefined();
    expect(withOtherErrors.housing_type).toBe(
      "El tipo de vivienda es obligatorio.",
    );

    expect(
      issuesOf(
        { home_ownership: "rented", rental_allows_pets: "unknown" },
        { step: 2 },
      ),
    ).toEqual({});
    expect(
      issuesOf(
        { home_ownership: "other", rental_allows_pets: "" },
        { step: 2 },
      ),
    ).toEqual({});
  });

  it("exige elegir una opción en las preguntas cerradas", () => {
    const issues = issuesOf({ home_ownership: "", hours_alone: "" });
    expect(issues.home_ownership).toBe(
      "Indicá si la vivienda es propia, alquilada u otra.",
    );
    expect(issues.hours_alone).toBe(
      "Indicá cuántas horas por día pasaría solo/a.",
    );
  });

  it("deja opcional el motivo de adopción", () => {
    expect(issuesOf({ adoption_reason: "" }, { step: 3 })).toEqual({});
    expect(
      issuesOf({ adoption_reason: "a".repeat(1001) }, { step: 3 })
        .adoption_reason,
    ).toBe("Este campo no puede superar los 1000 caracteres.");
  });

  it("pide la castración solo si la mascota no está castrada", () => {
    expect(
      issuesOf(
        { accepts_neutering: false },
        { step: 4, requiresNeutering: true },
      ).accepts_neutering,
    ).toBe("Tenés que comprometerte a castrarlo/a para enviar la solicitud.");
    expect(
      issuesOf(
        { accepts_neutering: false },
        { step: 4, requiresNeutering: false },
      ),
    ).toEqual({});
  });

  it("exige todas las casillas de compromiso", () => {
    const issues = issuesOf(
      {
        accepts_commitment: false,
        accepts_follow_up: false,
        accepts_return_notice: false,
        declares_truthful: false,
      },
      { step: 4 },
    );
    expect(Object.keys(issues).sort()).toEqual([
      "accepts_commitment",
      "accepts_follow_up",
      "accepts_return_notice",
      "declares_truthful",
    ]);
  });

  it("arma el cuerpo del POST con textos sin espacios de más", () => {
    const payload = toAdoptionRequestPayload(
      3,
      {
        ...COMPLETE,
        rental_allows_pets: "yes",
        adoption_reason: "  Me encantó  ",
      },
      false,
    );
    expect(payload).toMatchObject({
      pet: 3,
      full_name: "Tomás Gómez",
      age: 32,
      // No es alquilada: no se manda la respuesta del alquiler
      rental_allows_pets: "",
      adoption_reason: "Me encantó",
      accepts_neutering: null,
    });

    expect(
      toAdoptionRequestPayload(
        3,
        {
          ...COMPLETE,
          home_ownership: "rented",
          rental_allows_pets: "no",
          accepts_neutering: true,
        },
        true,
      ),
    ).toMatchObject({ rental_allows_pets: "no", accepts_neutering: true });
  });

  it("ubica el primer paso con errores", () => {
    expect(getFirstStepWithError(["declares_truthful", "hours_alone"])).toBe(3);
    expect(getFirstStepWithError(["email"])).toBe(1);
    expect(getFirstStepWithError(["pet"])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  buildCreatePetFormData,
  computeEstimatedBirthDate,
  DEFAULT_PET_FORM_VALUES,
  PET_PHOTO_FORMAT_ERROR,
  PET_PHOTO_MAX_BYTES,
  PET_PHOTO_SIZE_ERROR,
  petFormSchema,
  type PetFormValues,
  validatePetPhotoFile,
} from "@/lib/pets/form";

function validValues(overrides: Partial<PetFormValues> = {}): PetFormValues {
  return {
    ...DEFAULT_PET_FORM_VALUES,
    name: "Manchitas",
    species: "dog",
    sex: "male",
    ageValue: "2",
    ageUnit: "years",
    isNeutered: "true",
    isSociable: "true",
    goodWithChildren: "not_evaluated",
    goodWithAnimals: "not_evaluated",
    isUrgentRequested: false,
    hasSpecialCare: false,
    specialCare: "",
    contactPhone: "358 4123456",
    description: "Rescatado en barrio Alberdi, muy cariñoso.",
    ...overrides,
  };
}

describe("DEFAULT_PET_FORM_VALUES", () => {
  it("arranca sin castración ni sociabilidad marcadas y convivencia en Sin evaluar", () => {
    expect(DEFAULT_PET_FORM_VALUES.isNeutered).toBe("");
    expect(DEFAULT_PET_FORM_VALUES.isSociable).toBe("");
    expect(DEFAULT_PET_FORM_VALUES.goodWithChildren).toBe("not_evaluated");
    expect(DEFAULT_PET_FORM_VALUES.goodWithAnimals).toBe("not_evaluated");
    expect(DEFAULT_PET_FORM_VALUES.hasSpecialCare).toBe(false);
    expect(DEFAULT_PET_FORM_VALUES.isUrgentRequested).toBe(false);
  });
});

describe("petFormSchema", () => {
  it("acepta un formulario completo válido", () => {
    const result = petFormSchema.safeParse(validValues());
    expect(result.success).toBe(true);
  });

  it("rechaza castración y sociabilidad vacías, campos obligatorios y límites de caracteres", () => {
    const result = petFormSchema.safeParse(
      validValues({
        name: "   ",
        ageValue: "0",
        isNeutered: "",
        isSociable: "",
        contactPhone: "",
        description: "a".repeat(401),
      }),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = result.error.flatten().fieldErrors;
    expect(errors.name).toContain("El nombre de la mascota es obligatorio.");
    expect(errors.ageValue).toContain("La edad debe estar entre 1 y 30.");
    expect(errors.isNeutered).toContain("Indicá si la mascota está castrada.");
    expect(errors.isSociable).toContain("Indicá si la mascota es sociable.");
    expect(errors.contactPhone).toContain(
      "El teléfono de contacto es obligatorio.",
    );
    expect(errors.description).toContain(
      "La descripción no puede superar los 400 caracteres.",
    );
  });

  it("exige texto de cuidado especial (≤ 150) solo cuando la casilla está marcada", () => {
    const emptyChecked = petFormSchema.safeParse(
      validValues({ hasSpecialCare: true, specialCare: "   " }),
    );
    expect(emptyChecked.success).toBe(false);
    if (!emptyChecked.success) {
      expect(emptyChecked.error.flatten().fieldErrors.specialCare).toContain(
        "Contá qué problema de salud tiene o qué cuidados necesita.",
      );
    }

    const tooLong = petFormSchema.safeParse(
      validValues({ hasSpecialCare: true, specialCare: "x".repeat(151) }),
    );
    expect(tooLong.success).toBe(false);

    const unchecked = petFormSchema.safeParse(
      validValues({ hasSpecialCare: false, specialCare: "" }),
    );
    expect(unchecked.success).toBe(true);
  });
});

describe("computeEstimatedBirthDate", () => {
  it("resta años y ajusta 29 de febrero en año no bisiesto", () => {
    const leapDay = new Date(2024, 1, 29);
    expect(computeEstimatedBirthDate(1, "years", leapDay)).toBe("2023-02-28");
    expect(computeEstimatedBirthDate(2, "years", new Date(2026, 10, 25))).toBe(
      "2024-11-25",
    );
  });

  it("resta meses cruzando cambio de año y ajustando último día del mes", () => {
    expect(computeEstimatedBirthDate(5, "months", new Date(2026, 2, 31))).toBe(
      "2025-10-31",
    );
    expect(computeEstimatedBirthDate(1, "months", new Date(2026, 2, 31))).toBe(
      "2026-02-28",
    );
  });
});

describe("validatePetPhotoFile", () => {
  it("acepta JPG, PNG y WEBP dentro del límite de 5 MB", () => {
    const jpg = new File(["abc"], "loki.jpg", { type: "image/jpeg" });
    const png = new File(["abc"], "loki.png", { type: "image/png" });
    const webp = new File(["abc"], "loki.webp", { type: "image/webp" });

    expect(validatePetPhotoFile(jpg)).toBeNull();
    expect(validatePetPhotoFile(png)).toBeNull();
    expect(validatePetPhotoFile(webp)).toBeNull();
  });

  it("rechaza formatos no permitidos y archivos mayores a 5 MB", () => {
    const gif = new File(["abc"], "loki.gif", { type: "image/gif" });
    expect(validatePetPhotoFile(gif)).toBe(PET_PHOTO_FORMAT_ERROR);

    const big = new File([new Uint8Array(PET_PHOTO_MAX_BYTES + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    expect(validatePetPhotoFile(big)).toBe(PET_PHOTO_SIZE_ERROR);
  });
});

describe("buildCreatePetFormData", () => {
  it("arma el FormData con los campos esperados por PetCreateSerializer y varias fotos", () => {
    const photo1 = new File(["a"], "foto1.jpg", { type: "image/jpeg" });
    const photo2 = new File(["b"], "foto2.png", { type: "image/png" });
    const values = validValues({
      name: "  Manchitas  ",
      ageValue: "6",
      ageUnit: "months",
      isUrgentRequested: true,
      hasSpecialCare: true,
      specialCare: "  Medicación diaria  ",
    });

    const formData = buildCreatePetFormData(
      values,
      [photo1, photo2],
      new Date(2026, 10, 25),
    );

    expect(formData.get("name")).toBe("Manchitas");
    expect(formData.get("species")).toBe("dog");
    expect(formData.get("sex")).toBe("male");
    expect(formData.get("estimated_birth_date")).toBe("2026-05-25");
    expect(formData.get("is_neutered")).toBe("true");
    expect(formData.get("is_sociable")).toBe("true");
    expect(formData.get("good_with_children")).toBe("not_evaluated");
    expect(formData.get("good_with_animals")).toBe("not_evaluated");
    expect(formData.get("is_urgent_requested")).toBe("true");
    expect(formData.get("special_care")).toBe("Medicación diaria");
    expect(formData.get("contact_phone")).toBe("358 4123456");
    expect(formData.get("description")).toBe(
      "Rescatado en barrio Alberdi, muy cariñoso.",
    );
    expect(formData.getAll("photos")).toEqual([photo1, photo2]);
  });

  it("envía special_care vacío si la casilla de cuidado especial está desmarcada", () => {
    const photo = new File(["a"], "foto.jpg", { type: "image/jpeg" });
    const formData = buildCreatePetFormData(
      validValues({ hasSpecialCare: false, specialCare: "Texto viejo" }),
      [photo],
      new Date(2026, 10, 25),
    );

    expect(formData.get("special_care")).toBe("");
  });
});

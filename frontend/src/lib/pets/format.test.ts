import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatPetNeutered,
  formatPetSummaryLine,
  getPetCoverPhotoUrl,
  getPetSociabilityTag,
} from "@/lib/pets/format";
import { buildPet } from "@/lib/pets/testing";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPetSociabilityTag", () => {
  it("devuelve Sociable o Salvaje según is_sociable", () => {
    expect(getPetSociabilityTag({ is_sociable: true })).toEqual({
      label: "Sociable",
      tone: "sociable",
    });
    expect(getPetSociabilityTag({ is_sociable: false })).toEqual({
      label: "Salvaje",
      tone: "wild",
    });
  });
});

describe("formatPetNeutered", () => {
  it("concuerda con el sexo y avisa si no está castrada", () => {
    expect(formatPetNeutered({ is_neutered: true, sex: "male" })).toBe(
      "Castrado",
    );
    expect(formatPetNeutered({ is_neutered: true, sex: "female" })).toBe(
      "Castrada",
    );
    expect(formatPetNeutered({ is_neutered: false, sex: "female" })).toBe(
      "Sin castrar",
    );
  });
});

describe("formatPetSummaryLine", () => {
  const today = new Date(2026, 10, 23);

  it('arma "edad • castración" como el maquetado', () => {
    expect(
      formatPetSummaryLine(
        { estimated_birth_date: "2024-05-10", is_neutered: true, sex: "male" },
        today,
      ),
    ).toBe("2 Años • Castrado");
    expect(
      formatPetSummaryLine(
        {
          estimated_birth_date: "2026-03-10",
          is_neutered: true,
          sex: "female",
        },
        today,
      ),
    ).toBe("8 Meses • Castrada");
  });

  it("si la fecha no es válida muestra solo la castración", () => {
    expect(
      formatPetSummaryLine(
        { estimated_birth_date: "sin-fecha", is_neutered: false, sex: "male" },
        today,
      ),
    ).toBe("Sin castrar");
  });
});

describe("getPetCoverPhotoUrl", () => {
  it("usa la foto de menor position y la resuelve contra la API", () => {
    const pet = buildPet({
      photos: [
        {
          id: 3,
          image: "/media/pets/segunda.jpg",
          position: 1,
          created_at: "",
        },
        {
          id: 4,
          image: "/media/pets/portada.jpg",
          position: 0,
          created_at: "",
        },
      ],
    });

    expect(getPetCoverPhotoUrl(pet)).toBe(
      "http://api.test/media/pets/portada.jpg",
    );
  });

  it("devuelve null si no tiene fotos", () => {
    expect(getPetCoverPhotoUrl(buildPet({ photos: [] }))).toBeNull();
  });
});

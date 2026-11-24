import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPetHealthRows } from "@/lib/pets/format";
import {
  approvePet,
  fetchPetReviewQueue,
  getPublisherName,
  MAX_PET_REVIEW_NOTE_LENGTH,
  petReviewNoteSchema,
  rejectPet,
  setPetUrgency,
} from "@/lib/pets/review";
import { buildPet } from "@/lib/pets/testing";

const fetchMock = vi.fn();

function okResponse(body: unknown = { id: 1 }) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit];
}

describe("lib/pets/review", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("pide la cola de revisión y agrega la página solo si no es la primera", async () => {
    const empty = { count: 0, next: null, previous: null, results: [] };
    fetchMock
      .mockResolvedValueOnce(okResponse(empty))
      .mockResolvedValueOnce(okResponse(empty));

    await fetchPetReviewQueue();
    await fetchPetReviewQueue({ page: 2 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.test/api/pets/review-queue/",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://api.test/api/pets/review-queue/?page=2",
    );
  });

  it("aprueba y rechaza con la nota, vacía si no se escribió", async () => {
    // Una respuesta nueva por llamada: el cuerpo de un Response se lee una sola vez
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()));

    await approvePet(4, "Fotos claras.");
    let [url, init] = lastCall();
    expect(url).toBe("http://api.test/api/pets/4/approve/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ note: "Fotos claras." });

    await rejectPet(4);
    [url, init] = lastCall();
    expect(url).toBe("http://api.test/api/pets/4/reject/");
    expect(JSON.parse(init.body as string)).toEqual({ note: "" });
  });

  it("valida o quita la validación del caso urgente", async () => {
    // Una respuesta nueva por llamada: el cuerpo de un Response se lee una sola vez
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()));

    await setPetUrgency(4, true);
    expect(lastCall()[0]).toBe("http://api.test/api/pets/4/urgency/");
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({
      validated: true,
    });

    await setPetUrgency(4, false);
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({
      validated: false,
    });
  });

  it("acepta la nota vacía y limita el largo como el back", () => {
    expect(petReviewNoteSchema.safeParse({ note: "  " }).data?.note).toBe("");
    const tooLong = petReviewNoteSchema.safeParse({
      note: "a".repeat(MAX_PET_REVIEW_NOTE_LENGTH + 1),
    });
    expect(tooLong.error?.issues[0]?.message).toBe(
      "La nota no puede superar los 255 caracteres.",
    );
  });

  it("arma el nombre de quien publicó", () => {
    expect(getPublisherName(buildPet())).toBe("Refugio Patitas");
    expect(
      getPublisherName(
        buildPet({
          published_by: {
            id: 2,
            first_name: "",
            last_name: " ",
            role: { code: "member", name: "Miembro" },
          },
        }),
      ),
    ).toBe("quien la publicó");
  });
});

describe("getPetHealthRows", () => {
  it("devuelve solo las filas con datos, incluido el cuidado especial", () => {
    const rows = getPetHealthRows(
      buildPet({
        health: {
          general_status: "Sano",
          vaccines: " ",
          deworming: "Al día",
          flea_tick_treatment: "",
          other: "",
        },
        special_care: "Dieta renal",
      }),
    );

    expect(rows).toEqual([
      { label: "Estado clínico", value: "Sano" },
      { label: "Parásitos", value: "Al día" },
      { label: "Cuidado especial", value: "Dieta renal" },
    ]);
    expect(getPetHealthRows(buildPet({ health: null }))).toEqual([]);
  });
});

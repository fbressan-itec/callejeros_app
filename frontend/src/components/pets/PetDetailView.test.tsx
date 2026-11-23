import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREVIOUS_PATH_STORAGE_KEY } from "@/components/layout/BackButton";
import { PetDetailView } from "@/components/pets/PetDetailView";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import type { PetDetail } from "@/lib/pets/types";

const backMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
  }),
  usePathname: () => "/mascotas/1",
}));

const SAMPLE_PET: PetDetail = {
  id: 1,
  name: "Loki",
  species: "dog",
  sex: "male",
  estimated_birth_date: "2024-05-10",
  age_group: "adulto",
  is_sociable: true,
  good_with_children: "yes",
  good_with_animals: "yes",
  is_neutered: true,
  is_urgent: false,
  special_care: "",
  description: "Rescatado en barrio Alberdi. Es juguetón y sociable con niños.",
  notes: "Ideal para familias activas.",
  status: "published",
  published_by: {
    id: 2,
    first_name: "Refugio",
    last_name: "Patitas",
    role: { code: "verified_shelter", name: "Refugio verificado" },
  },
  health: {
    general_status: "Sano y vital",
    vaccines: "Al Día",
    deworming: "Desparasitado",
    flea_tick_treatment: "Pipeta al día",
    other: "",
  },
  badges: [
    { key: "species", tone: "neutral", icon: "dog", text: "Perro" },
    { key: "sex", tone: "sky", icon: "male", text: "Macho" },
  ],
  photos: [
    {
      id: 10,
      image: "http://api.test/media/pets/loki-1.jpg",
      position: 0,
      created_at: "2026-11-20T12:00:00Z",
    },
    {
      id: 11,
      image: "http://api.test/media/pets/loki-2.jpg",
      position: 1,
      created_at: "2026-11-20T12:00:00Z",
    },
  ],
  created_at: "2026-11-20T12:00:00Z",
  updated_at: "2026-11-20T12:00:00Z",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PetDetailView", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubGlobal("fetch", fetchMock);
    backMock.mockReset();
    fetchMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("muestra LoadingScreen mientras carga y luego renderiza el nombre, título y carrusel", async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<PetDetailView rawId="1" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Cargando ficha...")).toBeInTheDocument();

    resolveFetch(jsonResponse(200, SAMPLE_PET));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Loki" }),
      ).toBeInTheDocument();
    });

    expect(document.title).toBe(
      "Loki — Adoptá un Callejero — Callejeros Río Cuarto",
    );
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Foto 1 de 2 de Loki" }),
    ).toBeInTheDocument();
  });

  it('muestra "No encontramos esta mascota" para IDs inválidos o respuestas 404', async () => {
    const { rerender } = render(<PetDetailView rawId="no-es-un-id" />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "No encontramos esta mascota",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Ver el catálogo" }),
    ).toHaveAttribute("href", "/adopciones");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { detail: "No encontrado." }),
    );
    rerender(<PetDetailView rawId="999" />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "No encontramos esta mascota",
        }),
      ).toBeInTheDocument();
    });
  });

  it("muestra el mensaje de ApiError si la carga falla y permite reintentar", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("<h1>Error</h1>", { status: 500 }))
      .mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    render(<PetDetailView rawId="1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(ERROR_MESSAGES.server)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Loki" }),
      ).toBeInTheDocument();
    });
  });

  it("incluye el botón volver de 44×44 px apuntando a /adopciones y usa router.back cuando hay historial", async () => {
    window.sessionStorage.setItem(PREVIOUS_PATH_STORAGE_KEY, "/adopciones");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    render(<PetDetailView rawId="1" />);

    const backLink = screen.getByRole("link", { name: "Volver al catálogo" });
    expect(backLink).toHaveAttribute("href", "/adopciones");
    expect(backLink.className).toContain("min-w-[44px]");
    expect(backLink.className).toContain("min-h-[44px]");

    fireEvent.click(backLink);
    expect(backMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Loki" }),
      ).toBeInTheDocument();
    });
  });
});

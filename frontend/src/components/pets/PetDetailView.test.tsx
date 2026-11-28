import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthContextValue,
} from "@/components/auth/AuthProvider";
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
  age_label: "2 Años",
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
    {
      key: "age",
      tone: "orange",
      icon: "age_adulto",
      text: "Adulto (de 1 a 7 años): 2 Años",
    },
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

    // El título de la pestaña lo cambia un efecto que corre después de dibujar
    // el nombre: en una máquina lenta (CI) hay que esperarlo también.
    await waitFor(() => {
      expect(document.title).toBe(
        "Loki — Adoptá un Callejero — Callejeros Río Cuarto",
      );
    });
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

  it("muestra insignias, padrinos, desplegables cerrados y conecta Ver más con Descripción", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(90);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ...SAMPLE_PET, sponsors_count: 2 }),
    );

    render(<PetDetailView rawId="1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Loki" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Tocá una insignia para ver qué significa"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Loki tiene 2 padrinos que cubren su alimento y cuidados.",
      ),
    ).toBeInTheDocument();

    const descriptionSummary = screen.getByText("Descripción");
    const descriptionDetails = descriptionSummary.closest("details");
    expect(descriptionDetails).not.toBeNull();
    expect(descriptionDetails).not.toHaveAttribute("open");
    expect(screen.getByText("2 Años · Adulto")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver más" }));
    expect(descriptionDetails).toHaveAttribute("open");
  });

  it("abre AuthRequiredModal al tocar ¡Adoptame! sin sesión y comparte por WhatsApp si no hay navigator.share", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    render(<PetDetailView rawId="1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "¡Adoptame!" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar Sesión" }),
    ).toHaveAttribute("href", "/login?redirect=%2Fmascotas%2F1");

    fireEvent.click(
      screen.getByRole("button", { name: "Seguir mirando mascotas" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Compartir a Loki/i }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/?text="),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("con sesión iniciada abre el cuestionario de adopción al tocar ¡Adoptame!", async () => {
    const authValue: AuthContextValue = {
      user: {
        id: 1,
        email: "miembro@callejeros.ar",
        first_name: "Tomás",
        last_name: "Gómez",
        phone: "",
        is_phone_verified: true,
        photo: null,
        role: { code: "member", name: "Miembro" },
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      setSession: vi.fn(),
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    render(
      <AuthContext.Provider value={authValue}>
        <PetDetailView rawId="1" />
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "¡Adoptame!" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    expect(
      screen.getByRole("dialog", { name: "Adoptar a Loki" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
    // Nombre y correo de la cuenta, precargados
    expect(screen.getByLabelText("Nombre Completo *")).toHaveValue(
      "Tomás Gómez",
    );
    expect(screen.getByLabelText("Correo Electrónico *")).toHaveValue(
      "miembro@callejeros.ar",
    );
  });

  it('muestra "¡Ya encontró hogar! 🧡" y oculta ¡Adoptame! cuando la mascota está adoptada', async () => {
    const adoptedPet: PetDetail = {
      ...SAMPLE_PET,
      name: "Pancho",
      status: "adopted",
      badges: [
        {
          key: "adopted",
          tone: "orange",
          icon: "adopted",
          text: "¡Ya encontró hogar! 🧡",
        },
        { key: "species", tone: "neutral", icon: "dog", text: "Perro" },
      ],
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(200, adoptedPet));

    render(<PetDetailView rawId="7" />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Pancho" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("¡Ya encontró hogar! 🧡")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "¡Adoptame!" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "¡Ya encontró hogar! 🧡" }),
    ).toBeInTheDocument();
  });

  it("no inventa datos de salud ni notas vacías y usa No castrada para hembras sin castrar", async () => {
    const emptyHealthPet: PetDetail = {
      ...SAMPLE_PET,
      name: "Nala",
      sex: "female",
      age_group: "cachorro",
      age_label: "6 Meses",
      is_neutered: false,
      special_care: "",
      notes: "",
      health: {
        general_status: "",
        vaccines: "",
        deworming: "",
        flea_tick_treatment: "",
        other: "",
      },
      badges: [],
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(200, emptyHealthPet));

    render(<PetDetailView rawId="8" />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Nala" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("6 Meses · Cachorro")).toBeInTheDocument();
    expect(screen.getByText("No castrada")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Sin información cargada. Consultá con el rescatista.",
      ),
    ).toHaveLength(2);
    expect(
      screen.queryByText("Sin complicaciones detectadas"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Sano y bajo control veterinario"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Estado clínico")).not.toBeInTheDocument();
  });

  it("omite las filas vacías de salud (como Otros vacío) sin rellenarlas", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PET));

    render(<PetDetailView rawId="1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Loki" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Estado clínico")).toBeInTheDocument();
    expect(screen.getByText("Sano y vital")).toBeInTheDocument();
    expect(screen.queryByText("Otros")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Sin complicaciones detectadas"),
    ).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyPetsView } from "@/components/pets/MyPetsView";
import { ApiError } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/pagination";
import * as petsApi from "@/lib/pets/api";
import { buildPet } from "@/lib/pets/testing";
import type { PetDetail } from "@/lib/pets/types";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  usePathname: () => "/mis-publicaciones",
}));

function makePage(
  results: PetDetail[],
  overrides: Partial<PaginatedResponse<PetDetail>> = {},
): PaginatedResponse<PetDetail> {
  return {
    count: results.length,
    next: null,
    previous: null,
    results,
    ...overrides,
  };
}

describe("MyPetsView", () => {
  const fetchMyPetsSpy = vi.spyOn(petsApi, "fetchMyPets");
  const adoptPetSpy = vi.spyOn(petsApi, "adoptPet");
  const deactivatePetSpy = vi.spyOn(petsApi, "deactivatePet");

  beforeEach(() => {
    fetchMyPetsSpy.mockReset();
    adoptPetSpy.mockReset();
    deactivatePetSpy.mockReset();
    mockBack.mockReset();
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("muestra LoadingScreen mientras carga y renderiza estados, acciones y aviso en rechazadas", async () => {
    let resolveRequest!: (value: PaginatedResponse<PetDetail>) => void;
    fetchMyPetsSpy.mockReturnValueOnce(
      new Promise<PaginatedResponse<PetDetail>>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<MyPetsView />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando tus publicaciones...",
    );

    resolveRequest(
      makePage([
        buildPet({ id: 1, name: "Loki", status: "published" }),
        buildPet({ id: 2, name: "Milo", status: "in_review" }),
        buildPet({ id: 3, name: "Pancho", status: "adopted" }),
        buildPet({ id: 4, name: "Toto", status: "rejected" }),
      ]),
    );

    expect(
      await screen.findByRole("heading", { name: "Loki" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Milo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pancho" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Toto" })).toBeInTheDocument();

    // Solo las publicadas tienen botón "Marcar adoptada"
    expect(
      screen.getAllByRole("button", { name: "Marcar adoptada" }),
    ).toHaveLength(1);
    // Todas las activas tienen "Dar de baja"
    expect(screen.getAllByRole("button", { name: "Dar de baja" })).toHaveLength(
      4,
    );
    // Rechazada muestra aviso de estado final y enlace "Cargar nueva"
    expect(
      screen.getByText("Esta publicación fue rechazada y no se puede editar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cargar nueva" })).toHaveAttribute(
      "href",
      "/adopciones/publicar",
    );
  });

  it("filtra por estado, maneja estado vacío y permite volver a Todas", async () => {
    fetchMyPetsSpy
      .mockResolvedValueOnce(makePage([]))
      .mockResolvedValueOnce(makePage([]))
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 1, name: "Loki", status: "published" })]),
      );

    render(<MyPetsView />);

    expect(
      await screen.findByText("Todavía no publicaste mascotas"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Rechazadas" }));

    expect(
      await screen.findByText("No tenés publicaciones en este estado"),
    ).toBeInTheDocument();
    expect(fetchMyPetsSpy).toHaveBeenNthCalledWith(
      2,
      { status: "rejected", page: 1 },
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver todas" }));

    expect(
      await screen.findByRole("heading", { name: "Loki" }),
    ).toBeInTheDocument();
    expect(fetchMyPetsSpy).toHaveBeenNthCalledWith(
      3,
      { status: undefined, page: 1 },
      expect.anything(),
    );
  });

  it("muestra error de la API si falla la carga y permite reintentar", async () => {
    fetchMyPetsSpy
      .mockRejectedValueOnce(new ApiError(500, "Error del servidor."))
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 9, name: "Bora", status: "published" })]),
      );

    render(<MyPetsView />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Error del servidor.");

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("heading", { name: "Bora" }),
    ).toBeInTheDocument();
    expect(fetchMyPetsSpy).toHaveBeenCalledTimes(2);
  });

  it("permite marcar una mascota publicada como adoptada con nota opcional y recarga el listado", async () => {
    let resolveAdopt!: (value: PetDetail) => void;
    adoptPetSpy.mockReturnValueOnce(
      new Promise<PetDetail>((resolve) => {
        resolveAdopt = resolve;
      }),
    );

    const publishedLoki = buildPet({
      id: 1,
      name: "Loki",
      status: "published",
    });
    const adoptedLoki = buildPet({ id: 1, name: "Loki", status: "adopted" });

    fetchMyPetsSpy
      .mockResolvedValueOnce(makePage([publishedLoki]))
      .mockResolvedValueOnce(makePage([adoptedLoki]));

    render(<MyPetsView />);
    await screen.findByRole("heading", { name: "Loki" });

    fireEvent.click(screen.getByRole("button", { name: "Marcar adoptada" }));

    expect(
      screen.getByRole("dialog", { name: "Marcar a Loki como adoptada" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nota (opcional)"), {
      target: { value: "Se fue con una familia en Alberdi" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar adopción" }));

    expect(
      await screen.findByRole("button", { name: "Guardando..." }),
    ).toBeDisabled();

    resolveAdopt(adoptedLoki);

    expect(
      await screen.findByText(
        "¡Qué alegría! Loki quedó marcada como adoptada.",
      ),
    ).toBeInTheDocument();
    expect(adoptPetSpy).toHaveBeenCalledWith(
      1,
      "Se fue con una familia en Alberdi",
    );
    await waitFor(() => {
      expect(fetchMyPetsSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("permite dar de baja lógica una publicación y recarga el listado", async () => {
    let resolveDeactivate!: () => void;
    deactivatePetSpy.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDeactivate = resolve;
      }),
    );

    fetchMyPetsSpy
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 2, name: "Milo", status: "in_review" })]),
      )
      .mockResolvedValueOnce(makePage([]));

    render(<MyPetsView />);
    await screen.findByRole("heading", { name: "Milo" });

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));

    const dialog = screen.getByRole("dialog", {
      name: "Dar de baja a Milo",
    });
    expect(dialog).toBeInTheDocument();

    const confirmBtn = screen
      .getAllByRole("button", { name: "Dar de baja" })
      .find((btn) => dialog.contains(btn));
    expect(confirmBtn).toBeDefined();
    fireEvent.click(confirmBtn!);

    expect(
      await screen.findByRole("button", { name: "Dando de baja..." }),
    ).toBeDisabled();

    resolveDeactivate();

    expect(
      await screen.findByText("Milo fue dada de baja correctamente."),
    ).toBeInTheDocument();
    expect(deactivatePetSpy).toHaveBeenCalledWith(2);
    await waitFor(() => {
      expect(fetchMyPetsSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("pagina de a 12 resultados cuando hay más de una página", async () => {
    fetchMyPetsSpy
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 1, name: "Loki" })], {
          count: 14,
          next: "http://api.test/api/pets/mine/?page=2",
        }),
      )
      .mockResolvedValueOnce(
        makePage([buildPet({ id: 13, name: "Thor" })], {
          count: 14,
          previous: "http://api.test/api/pets/mine/?page=1",
        }),
      );

    render(<MyPetsView />);
    await screen.findByRole("heading", { name: "Loki" });

    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(
      await screen.findByRole("heading", { name: "Thor" }),
    ).toBeInTheDocument();
    expect(fetchMyPetsSpy).toHaveBeenNthCalledWith(
      2,
      { status: undefined, page: 2 },
      expect.anything(),
    );
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaffPanel } from "@/components/staff/StaffPanel";
import { buildAdoptionRequestReview } from "@/lib/adoptions/testing";
import type { AdoptionRequestReview } from "@/lib/adoptions/types";
import { ApiError } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/pagination";

const fetchQueueMock = vi.fn();

vi.mock("@/lib/adoptions/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/adoptions/api")>()),
  fetchAdoptionReviewQueue: (...args: unknown[]) => fetchQueueMock(...args),
}));

function page(
  results: AdoptionRequestReview[],
  overrides: Partial<PaginatedResponse<AdoptionRequestReview>> = {},
): PaginatedResponse<AdoptionRequestReview> {
  return {
    count: results.length,
    next: null,
    previous: null,
    results,
    ...overrides,
  };
}

describe("StaffPanel", () => {
  beforeEach(() => {
    fetchQueueMock.mockReset();
  });

  it("muestra la pestaña de solicitudes y la cola con LoadingScreen mientras carga", async () => {
    fetchQueueMock.mockResolvedValueOnce(
      page([
        buildAdoptionRequestReview(),
        buildAdoptionRequestReview({
          id: 8,
          pet: {
            id: 4,
            name: "Bora",
            species: "cat",
            sex: "female",
            status: "published",
            main_photo: null,
          },
          full_name: "Martín Ruiz",
        }),
      ]),
    );

    render(<StaffPanel />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Panel de Staff" }),
    ).toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: "📋 Solicitudes de adopción" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando solicitudes...",
    );

    const loki = await screen.findByRole("article", { name: "Loki" });
    // El nombre aparece en la tarjeta y en el cuestionario
    expect(within(loki).getAllByText("Sofía Gómez")[0]).toBeVisible();
    expect(within(loki).getByText("20/11/2026")).toBeInTheDocument();
    expect(within(loki).getByText("🐶 Perro • Macho")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Bora" })).toHaveTextContent(
      "🐱 Gato • Hembra",
    );
    expect(screen.getByText(/2 solicitudes pendientes/)).toBeInTheDocument();
    expect(fetchQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );
  });

  it("muestra el cuestionario completo en el desplegable", async () => {
    fetchQueueMock.mockResolvedValueOnce(
      page([
        buildAdoptionRequestReview({
          home_ownership: "rented",
          rental_allows_pets: "yes",
        }),
      ]),
    );

    render(<StaffPanel />);

    const card = await screen.findByRole("article", { name: "Loki" });
    const summary = within(card).getByText("Ver cuestionario");
    fireEvent.click(summary);

    for (const title of [
      "1. Datos Personales",
      "2. Hogar y Entorno",
      "3. Experiencia y Rutina",
      "4. Compromiso",
    ]) {
      expect(
        within(card).getByRole("heading", { level: 3, name: title }),
      ).toBeInTheDocument();
    }
    expect(within(card).getByText("Alquilada")).toBeInTheDocument();
    expect(
      within(card).getByText("¿El contrato o el dueño permite animales?"),
    ).toBeInTheDocument();
    expect(within(card).getByText("sofia@example.com")).toBeInTheDocument();
  });

  it("avisa cuando no hay solicitudes pendientes", async () => {
    fetchQueueMock.mockResolvedValueOnce(page([]));

    render(<StaffPanel />);

    expect(
      await screen.findByText("No hay solicitudes pendientes."),
    ).toBeInTheDocument();
  });

  it("muestra el error y vuelve a pedir la cola al reintentar", async () => {
    fetchQueueMock
      .mockRejectedValueOnce(
        new ApiError(403, "No tenés permiso para hacer esto."),
      )
      .mockResolvedValueOnce(page([buildAdoptionRequestReview()]));

    render(<StaffPanel />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar las solicitudes");
    expect(alert).toHaveTextContent("No tenés permiso para hacer esto.");

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("article", { name: "Loki" }),
    ).toBeInTheDocument();
    expect(fetchQueueMock).toHaveBeenCalledTimes(2);
  });

  it("pagina de a 12 solicitudes", async () => {
    const results = Array.from({ length: 12 }, (_, index) =>
      buildAdoptionRequestReview({ id: index + 1 }),
    );
    fetchQueueMock
      .mockResolvedValueOnce(page(results, { count: 13, next: "?page=2" }))
      .mockResolvedValueOnce(
        page([buildAdoptionRequestReview({ id: 13 })], {
          count: 13,
          previous: "?page=1",
        }),
      );

    render(<StaffPanel />);

    expect(await screen.findByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("Página 2 de 2")).toBeInTheDocument();
    expect(fetchQueueMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });
});

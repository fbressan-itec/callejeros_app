import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PetReviewQueue } from "@/components/staff/PetReviewQueue";
import { StaffPanel } from "@/components/staff/StaffPanel";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import type { PaginatedResponse } from "@/lib/api/pagination";
import { DEFAULT_PET_REJECTION_NOTE } from "@/lib/pets/review";
import { buildPetReviewItem } from "@/lib/pets/testing";
import type { PetReviewItem } from "@/lib/pets/types";

const fetchPetQueueMock = vi.fn();
const approveMock = vi.fn();
const rejectMock = vi.fn();
const urgencyMock = vi.fn();
const fetchAdoptionQueueMock = vi.fn();

vi.mock("@/lib/pets/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pets/review")>()),
  fetchPetReviewQueue: (...args: unknown[]) => fetchPetQueueMock(...args),
  approvePet: (...args: unknown[]) => approveMock(...args),
  rejectPet: (...args: unknown[]) => rejectMock(...args),
  setPetUrgency: (...args: unknown[]) => urgencyMock(...args),
}));

vi.mock("@/lib/adoptions/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/adoptions/api")>()),
  fetchAdoptionReviewQueue: (...args: unknown[]) =>
    fetchAdoptionQueueMock(...args),
}));

function page(results: PetReviewItem[]): PaginatedResponse<PetReviewItem> {
  return { count: results.length, next: null, previous: null, results };
}

const PET = buildPetReviewItem({
  health: {
    general_status: "Sano",
    vaccines: "Antirrábica",
    deworming: "",
    flea_tick_treatment: "",
    other: "",
  },
  notes: "Le teme a los ruidos fuertes.",
});

async function findCard(name = "Loki") {
  return screen.findByRole("article", { name });
}

describe("PetReviewQueue", () => {
  beforeEach(() => {
    fetchPetQueueMock.mockReset();
    approveMock.mockReset();
    rejectMock.mockReset();
    urgencyMock.mockReset();
    fetchAdoptionQueueMock.mockReset();
    document.body.className = "";
  });

  it("se abre desde la pestaña del panel y muestra la ficha de gestión", async () => {
    fetchAdoptionQueueMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    fetchPetQueueMock.mockResolvedValueOnce(page([PET]));

    render(<StaffPanel />);
    const tab = screen.getByRole("tab", {
      name: "🐾 Publicaciones en revisión",
    });
    fireEvent.click(tab);

    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando publicaciones...",
    );
    const card = await findCard();
    expect(card).toHaveTextContent("🐶 Perro • Macho • 2 Años • Castrado");
    expect(card).toHaveTextContent("Refugio Patitas");
    expect(within(card).getByText("Refugio verificado")).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: "358 4222222" }),
    ).toHaveAttribute("href", "tel:3584222222");
    expect(card).toHaveTextContent("Antirrábica");
    expect(card).toHaveTextContent("Le teme a los ruidos fuertes.");
    expect(screen.getByText(/1 publicación en revisión/)).toBeInTheDocument();
  });

  it("cambia de pestaña con las flechas del teclado", () => {
    fetchAdoptionQueueMock.mockReturnValue(new Promise(() => {}));
    fetchPetQueueMock.mockReturnValue(new Promise(() => {}));

    render(<StaffPanel />);
    const adoptions = screen.getByRole("tab", {
      name: "📋 Solicitudes de adopción",
    });
    adoptions.focus();
    fireEvent.keyDown(adoptions, { key: "ArrowRight" });

    const pets = screen.getByRole("tab", {
      name: "🐾 Publicaciones en revisión",
    });
    expect(pets).toHaveFocus();
    expect(pets).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(pets, { key: "ArrowRight" });
    expect(adoptions).toHaveFocus();
  });

  it("valida y quita la validación del caso urgente sin sacar la mascota de la cola", async () => {
    const urgent = buildPetReviewItem({ is_urgent_requested: true });
    fetchPetQueueMock.mockResolvedValueOnce(page([urgent]));
    urgencyMock
      .mockResolvedValueOnce({ ...urgent, is_urgent_validated: true })
      .mockResolvedValueOnce({ ...urgent, is_urgent_validated: false });

    render(<PetReviewQueue />);
    const card = await findCard();
    expect(card).toHaveTextContent("🚨 Pidió caso urgente");

    fireEvent.click(
      within(card).getByRole("button", { name: "Validar urgente" }),
    );
    expect(
      within(card).getByRole("button", { name: "Validando…" }),
    ).toBeDisabled();

    const remove = await within(card).findByRole("button", {
      name: "Quitar validación",
    });
    expect(remove).toHaveAttribute("aria-pressed", "true");
    expect(urgencyMock).toHaveBeenLastCalledWith(1, true);

    fireEvent.click(remove);
    expect(
      await within(card).findByRole("button", { name: "Validar urgente" }),
    ).toBeInTheDocument();
    expect(urgencyMock).toHaveBeenLastCalledWith(1, false);
    expect(fetchPetQueueMock).toHaveBeenCalledTimes(1);
  });

  it("no muestra el control de urgencia si no lo pidió", async () => {
    fetchPetQueueMock.mockResolvedValueOnce(page([PET]));

    render(<PetReviewQueue />);
    const card = await findCard();

    expect(card).not.toHaveTextContent("Pidió caso urgente");
  });

  it("aprueba con nota opcional y saca la mascota de la cola", async () => {
    fetchPetQueueMock
      .mockResolvedValueOnce(page([PET]))
      .mockResolvedValueOnce(page([]));
    approveMock.mockResolvedValueOnce({ ...PET, status: "published" });

    render(<PetReviewQueue />);
    const card = await findCard();
    fireEvent.click(within(card).getByRole("button", { name: "Aprobar" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Aprobar publicación");
    expect(dialog).toHaveTextContent(
      "¿Aprobar la publicación de Loki? Va a aparecer en el catálogo de adopción.",
    );
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toHaveFocus();

    fireEvent.change(within(dialog).getByLabelText("Nota (opcional)"), {
      target: { value: "  Fotos claras.  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aprobar" }));

    expect(
      await screen.findByText(
        "✅ Aprobaste la publicación de Loki. Ya está en el catálogo.",
      ),
    ).toBeInTheDocument();
    expect(approveMock).toHaveBeenCalledWith(1, "Fotos claras.");
    expect(
      await screen.findByText("No hay publicaciones en revisión."),
    ).toBeInTheDocument();
  });

  it("rechaza sin motivo y avisa cuál se guarda por defecto", async () => {
    fetchPetQueueMock
      .mockResolvedValueOnce(page([PET]))
      .mockResolvedValueOnce(page([]));
    rejectMock.mockResolvedValueOnce({ ...PET, status: "rejected" });

    render(<PetReviewQueue />);
    const card = await findCard();
    fireEvent.click(within(card).getByRole("button", { name: "Rechazar" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "¿Rechazar la publicación de Loki? Es final: para volver a intentarlo, Refugio Patitas tiene que cargarla de nuevo.",
    );
    expect(dialog).toHaveTextContent(DEFAULT_PET_REJECTION_NOTE);

    fireEvent.click(within(dialog).getByRole("button", { name: "Rechazar" }));

    expect(
      await screen.findByText("Rechazaste la publicación de Loki."),
    ).toBeInTheDocument();
    expect(rejectMock).toHaveBeenCalledWith(1, "");
  });

  it("muestra el error del back y vuelve a pedir la cola al cerrar", async () => {
    fetchPetQueueMock
      .mockResolvedValueOnce(page([PET]))
      .mockResolvedValueOnce(page([]));
    approveMock.mockRejectedValueOnce(
      new ApiError(400, ERROR_MESSAGES.validation, {
        status: ["La mascota ya fue revisada."],
      }),
    );

    render(<PetReviewQueue />);
    const card = await findCard();
    fireEvent.click(within(card).getByRole("button", { name: "Aprobar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Aprobar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "La mascota ya fue revisada.",
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      await screen.findByText("No hay publicaciones en revisión."),
    ).toBeInTheDocument();
    expect(fetchPetQueueMock).toHaveBeenCalledTimes(2);
  });
});

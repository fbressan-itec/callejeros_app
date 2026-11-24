import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdoptionReviewQueue } from "@/components/staff/AdoptionReviewQueue";
import { REJECTION_REASON_MESSAGES } from "@/lib/adoptions/review";
import { buildAdoptionRequestReview } from "@/lib/adoptions/testing";
import type { AdoptionRequestReview } from "@/lib/adoptions/types";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import type { PaginatedResponse } from "@/lib/api/pagination";

const fetchQueueMock = vi.fn();
const approveMock = vi.fn();
const rejectMock = vi.fn();

vi.mock("@/lib/adoptions/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/adoptions/api")>()),
  fetchAdoptionReviewQueue: (...args: unknown[]) => fetchQueueMock(...args),
  approveAdoptionRequest: (...args: unknown[]) => approveMock(...args),
  rejectAdoptionRequest: (...args: unknown[]) => rejectMock(...args),
}));

function page(
  results: AdoptionRequestReview[],
): PaginatedResponse<AdoptionRequestReview> {
  return { count: results.length, next: null, previous: null, results };
}

const REQUEST = buildAdoptionRequestReview();

async function openAction(name: "Aprobar" | "Desaprobar") {
  const card = await screen.findByRole("article", { name: "Loki" });
  fireEvent.click(within(card).getByRole("button", { name }));
  return screen.getByRole("dialog");
}

describe("AdoptionReviewQueue: aprobar y desaprobar", () => {
  beforeEach(() => {
    fetchQueueMock.mockReset();
    approveMock.mockReset();
    rejectMock.mockReset();
    document.body.className = "";
  });

  it("pide confirmación antes de aprobar y saca la solicitud de la cola", async () => {
    fetchQueueMock
      .mockResolvedValueOnce(page([REQUEST]))
      .mockResolvedValueOnce(page([]));
    approveMock.mockResolvedValueOnce({ ...REQUEST, status: "approved" });

    render(<AdoptionReviewQueue />);
    const dialog = await openAction("Aprobar");

    expect(dialog).toHaveAccessibleName("Aprobar solicitud");
    expect(dialog).toHaveTextContent(
      "¿Aprobar la solicitud de Sofía Gómez para Loki? Va a recibir el teléfono de contacto de la publicación.",
    );
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toHaveFocus();
    expect(approveMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(
      within(dialog).getByRole("button", { name: "Aprobando…" }),
    ).toBeDisabled();
    expect(
      await screen.findByText(
        "✅ Aprobaste la solicitud de Sofía Gómez para Loki.",
      ),
    ).toBeInTheDocument();
    expect(approveMock).toHaveBeenCalledWith(7);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      await screen.findByText("No hay solicitudes pendientes."),
    ).toBeInTheDocument();
    expect(fetchQueueMock).toHaveBeenCalledTimes(2);
  });

  it("cancelar o Escape cierran sin aprobar y devuelven el foco al botón", async () => {
    fetchQueueMock.mockResolvedValueOnce(page([REQUEST]));

    render(<AdoptionReviewQueue />);
    const dialog = await openAction("Aprobar");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const approveButton = screen.getByRole("button", { name: "Aprobar" });
    approveButton.focus();
    fireEvent.click(approveButton);
    expect(document.body).toHaveClass("overflow-hidden");
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(approveButton).toHaveFocus();
    expect(document.body).not.toHaveClass("overflow-hidden");
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("muestra el motivo del back si no se puede aprobar y vuelve a pedir la cola al cerrar", async () => {
    fetchQueueMock
      .mockResolvedValueOnce(page([REQUEST]))
      .mockResolvedValueOnce(page([REQUEST]));
    approveMock.mockRejectedValueOnce(
      new ApiError(400, ERROR_MESSAGES.validation, {
        pet: ["Esta mascota ya no está disponible para adopción."],
      }),
    );

    render(<AdoptionReviewQueue />);
    const dialog = await openAction("Aprobar");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Esta mascota ya no está disponible para adopción.",
    );
    expect(
      within(dialog).getByRole("button", { name: "Confirmar" }),
    ).toBeEnabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(fetchQueueMock).toHaveBeenCalledTimes(2);
  });

  it("exige el motivo para desaprobar y lo envía sin espacios de más", async () => {
    fetchQueueMock
      .mockResolvedValueOnce(page([REQUEST]))
      .mockResolvedValueOnce(page([]));
    rejectMock.mockResolvedValueOnce({ ...REQUEST, status: "rejected" });

    render(<AdoptionReviewQueue />);
    const dialog = await openAction("Desaprobar");
    const reason = within(dialog).getByLabelText("Motivo *");

    expect(dialog).toHaveAccessibleName("Desaprobar solicitud");
    expect(reason).toHaveFocus();

    fireEvent.click(within(dialog).getByRole("button", { name: "Desaprobar" }));

    expect(
      await within(dialog).findByText(REJECTION_REASON_MESSAGES.required),
    ).toBeInTheDocument();
    expect(rejectMock).not.toHaveBeenCalled();

    fireEvent.change(reason, {
      target: { value: "  Necesita un patio cerrado.  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Desaprobar" }));

    expect(
      await screen.findByText(
        "Desaprobaste la solicitud de Sofía Gómez para Loki. Va a ver el motivo en su solicitud.",
      ),
    ).toBeInTheDocument();
    expect(rejectMock).toHaveBeenCalledWith(7, "Necesita un patio cerrado.");
  });

  it("muestra junto al campo el error del motivo que devuelve el back", async () => {
    fetchQueueMock.mockResolvedValueOnce(page([REQUEST]));
    rejectMock.mockRejectedValueOnce(
      new ApiError(400, ERROR_MESSAGES.validation, {
        rejection_reason: [REJECTION_REASON_MESSAGES.tooLong],
      }),
    );

    render(<AdoptionReviewQueue />);
    const dialog = await openAction("Desaprobar");
    fireEvent.change(within(dialog).getByLabelText("Motivo *"), {
      target: { value: "Motivo" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Desaprobar" }));

    expect(
      await within(dialog).findByText(REJECTION_REASON_MESSAGES.tooLong),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Motivo *")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

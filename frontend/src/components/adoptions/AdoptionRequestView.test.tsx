import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADOPTION_REQUEST_POLL_INTERVAL_MS,
  AdoptionRequestView,
} from "@/components/adoptions/AdoptionRequestView";
import type { AdoptionRequestDetail } from "@/lib/adoptions/types";
import { ERROR_MESSAGES } from "@/lib/api/errors";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
  usePathname: () => "/solicitudes/7",
}));

const BASE_REQUEST: AdoptionRequestDetail = {
  id: 7,
  pet: {
    id: 3,
    name: "Bora",
    species: "dog",
    sex: "female",
    status: "published",
    main_photo: "http://api.test/media/pets/bora.jpg",
  },
  status: "pending",
  rejection_reason: "",
  foster_contact: null,
  reviewed_at: null,
  created_at: "2026-11-20T15:00:00Z",
  updated_at: "2026-11-20T15:00:00Z",
};

const APPROVED_REQUEST: AdoptionRequestDetail = {
  ...BASE_REQUEST,
  status: "approved",
  reviewed_at: "2026-11-21T15:00:00Z",
  foster_contact: {
    name: "Refugio Patitas",
    role: { code: "verified_shelter", name: "Refugio verificado" },
    contact_phone: "+54 9 358 4222222",
    shelter_public_address: "Sobremonte 1250, Río Cuarto",
  },
};

/**
 * Sigue los intervalos de la consulta periódica para esperar a que arranquen o se corten.
 * El encabezado aparece antes de que React corra los efectos: si se adelanta el reloj
 * antes, todavía no hay intervalo que disparar (pasaba en el CI, que es más lento).
 */
function spyOnPollingTimers() {
  const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
  const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
  const pollTimerIds = () =>
    setIntervalSpy.mock.calls
      .map((call, index) => ({ call, index }))
      .filter(({ call }) => call[1] === ADOPTION_REQUEST_POLL_INTERVAL_MS)
      .map(({ index }) => setIntervalSpy.mock.results[index]?.value);

  return {
    // waitFor también usa setInterval: se cuentan solo los de 60 s
    waitForStart: () =>
      waitFor(() => expect(pollTimerIds().length).toBeGreaterThan(0)),
    waitForStop: () =>
      waitFor(() =>
        expect(
          pollTimerIds().every((id) =>
            clearIntervalSpy.mock.calls.some((call) => call[0] === id),
          ),
        ).toBe(true),
      ),
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdoptionRequestView", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("muestra LoadingScreen mientras carga y después la solicitud en revisión", async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<AdoptionRequestView rawId="7" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando solicitud...",
    );

    resolveFetch(jsonResponse(200, BASE_REQUEST));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Tu solicitud está en revisión",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bora")).toBeInTheDocument();
    expect(screen.getByText("Enviada el 20/11/2026")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Foto de Bora" }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://api.test/api/adoption-requests/7/",
    );
  });

  it("muestra el contacto, la dirección del refugio y los próximos pasos si está aprobada", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, APPROVED_REQUEST));

    render(<AdoptionRequestView rawId="7" />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "¡Solicitud aprobada!",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Refugio Patitas")).toBeInTheDocument();
    expect(screen.getByText("Refugio verificado")).toBeInTheDocument();
    expect(screen.getByText("+54 9 358 4222222")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "📞 Llamar para coordinar" }),
    ).toHaveAttribute("href", "tel:+5493584222222");
    expect(
      screen.getByRole("heading", { name: "📍 Dirección del refugio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sobremonte 1250, Río Cuarto")).toBeInTheDocument();
    const mapLink = screen.getByRole("link", { name: "🗺️ Ver en el mapa" });
    expect(mapLink).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Sobremonte%201250%2C%20R%C3%ADo%20Cuarto",
    );
    expect(mapLink).toHaveAttribute("target", "_blank");
    expect(
      screen.getByText(
        "Por tu seguridad y la del animal, te recomendamos que el primer encuentro sea en un lugar público.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Coordiná el encuentro con Refugio Patitas."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Conocé a Bora y hacé todas las preguntas que necesites.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Firmen el acta de adopción responsable."),
    ).toBeInTheDocument();
    // Sin punto de encuentro
    expect(screen.queryByText(/Punto de encuentro/i)).not.toBeInTheDocument();
  });

  it("no muestra la dirección si quien publicó no es un refugio con dirección pública", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ...APPROVED_REQUEST,
        foster_contact: {
          name: "Laura Gómez",
          role: { code: "member", name: "Miembro de la comunidad" },
          contact_phone: "358 412 0000",
          shelter_public_address: null,
        },
      }),
    );

    render(<AdoptionRequestView rawId="7" />);

    expect(await screen.findByText("Laura Gómez")).toBeInTheDocument();
    expect(screen.getByText("Miembro de la comunidad")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "📍 Dirección del refugio" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "🗺️ Ver en el mapa" }),
    ).not.toBeInTheDocument();
  });

  it("muestra el motivo del moderador y los enlaces si está desaprobada", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ...BASE_REQUEST,
        status: "rejected",
        rejection_reason: "Pedimos un patio con cerco para su seguridad.",
      }),
    );

    render(<AdoptionRequestView rawId="7" />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Esta vez no pudimos aprobar tu solicitud",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "¿Por qué?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pedimos un patio con cerco para su seguridad."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "¡Te esperamos de nuevo! También podés ayudar apadrinando o como hogar de tránsito.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "📘 Aprender sobre Adopción Responsable",
      }),
    ).toHaveAttribute("href", "/adopcion-responsable");
    expect(
      screen.getByRole("link", { name: "Otras formas de ayudar" }),
    ).toHaveAttribute("href", "/donaciones#apadrinar");
  });

  it('muestra "No encontramos esa solicitud" para IDs inválidos o respuestas 404', async () => {
    const { unmount } = render(<AdoptionRequestView rawId="abc" />);

    expect(
      screen.getByRole("heading", { name: "No encontramos esa solicitud" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Puede que no exista o que no tengas acceso."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { detail: "No encontrado." }),
    );
    render(<AdoptionRequestView rawId="99" />);

    expect(
      await screen.findByRole("heading", {
        name: "No encontramos esa solicitud",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver mascotas en adopción" }),
    ).toHaveAttribute("href", "/adopciones");
  });

  it("muestra el mensaje de errors.ts si falla y permite reintentar", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, BASE_REQUEST));

    render(<AdoptionRequestView rawId="7" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      ERROR_MESSAGES.network,
    );

    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));

    expect(
      await screen.findByRole("heading", {
        name: "Tu solicitud está en revisión",
      }),
    ).toBeInTheDocument();
  });

  it("vuelve a consultar en revisión y deja de hacerlo cuando llega la respuesta", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const timers = spyOnPollingTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, BASE_REQUEST))
      .mockResolvedValueOnce(jsonResponse(200, BASE_REQUEST))
      .mockResolvedValueOnce(jsonResponse(200, APPROVED_REQUEST));

    render(<AdoptionRequestView rawId="7" />);
    await screen.findByRole("heading", {
      name: "Tu solicitud está en revisión",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await timers.waitForStart();

    act(() => {
      vi.advanceTimersByTime(ADOPTION_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("heading", { name: "Tu solicitud está en revisión" }),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(ADOPTION_REQUEST_POLL_INTERVAL_MS);
    });
    expect(
      await screen.findByRole("heading", { name: "¡Solicitud aprobada!" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Estado final: se corta el intervalo y no vuelve a consultar
    await timers.waitForStop();
    act(() => {
      vi.advanceTimersByTime(ADOPTION_REQUEST_POLL_INTERVAL_MS * 3);
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("si una consulta en segundo plano falla, conserva lo que ya mostraba", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const timers = spyOnPollingTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, BASE_REQUEST))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<AdoptionRequestView rawId="7" />);
    await screen.findByRole("heading", {
      name: "Tu solicitud está en revisión",
    });
    await timers.waitForStart();

    act(() => {
      vi.advanceTimersByTime(ADOPTION_REQUEST_POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(
      screen.getByRole("heading", { name: "Tu solicitud está en revisión" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

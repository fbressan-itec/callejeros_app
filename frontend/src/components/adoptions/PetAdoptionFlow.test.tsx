import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PetAdoptionFlow } from "@/components/adoptions/PetAdoptionFlow";
import {
  AuthContext,
  type AuthContextValue,
} from "@/components/auth/AuthProvider";
import { OWN_PET_ADOPTION_MESSAGE } from "@/components/pets/PetActions";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import { AUTH_SESSION_STORAGE_KEY } from "@/lib/auth/session";
import type { PetDetail } from "@/lib/pets/types";

const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  usePathname: () => "/mascotas/3",
}));

const USER = {
  id: 1,
  email: "miembro@callejeros.ar",
  first_name: "Tomás",
  last_name: "Gómez",
  phone: "",
  is_phone_verified: true,
  photo: null,
  role: { code: "member" as const, name: "Miembro de la comunidad" },
};

const PET = {
  id: 3,
  name: "Bora",
  sex: "female",
  status: "published",
  is_neutered: false,
  published_by: {
    id: 2,
    first_name: "Refugio",
    last_name: "Patitas",
    role: { code: "verified_shelter", name: "Refugio verificado" },
  },
} as unknown as PetDetail;

function authValue(user = USER): AuthContextValue {
  return {
    user,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setSession: vi.fn(),
  };
}

function renderFlow(pet: PetDetail = PET, auth = authValue()) {
  return render(
    <AuthContext.Provider value={auth}>
      <PetAdoptionFlow pet={pet} />
    </AuthContext.Provider>,
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function clickNext() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  });
}

async function fillUntilStep4() {
  type("Edad *", "32");
  type("WhatsApp / Teléfono *", "358 4111111");
  type("Dirección *", "Sobremonte 100");
  type("Localidad *", "Río Cuarto");
  await clickNext();
  await screen.findByText("Paso 2 de 4");

  type("Tipo de Vivienda *", "Casa con patio");
  fireEvent.click(screen.getByLabelText("Propia"));
  type(/patio, balcón o terraza/, "Patio con cerco alto");
  type("¿Quiénes viven con vos? *", "Dos adultos");
  fireEvent.click(
    within(
      screen.getByRole("group", { name: /Todos en tu casa están de acuerdo/ }),
    ).getByLabelText("Sí"),
  );
  type("¿Tenés otros animales actualmente? *", "Una gata castrada");
  await clickNext();
  await screen.findByText("Paso 3 de 4");

  type(/Tuviste animales antes/, "Un perro que vivió 15 años");
  fireEvent.click(screen.getByLabelText("4 a 8"));
  type(/Dónde va a dormir/, "Adentro de la casa");
  type(/Quién lo cuida si viajás/, "Mi hermana");
  type(/Qué harías si te mudás/, "Me lo llevo conmigo");
  await clickNext();
  await screen.findByText("Paso 4 de 4");
}

function checkAllCommitments() {
  for (const checkbox of screen.getAllByRole("checkbox")) {
    fireEvent.click(checkbox);
  }
}

describe("PetAdoptionFlow", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({ access: "token", refresh: "refresh", user: USER }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.body.classList.remove("overflow-hidden");
  });

  it("si la mascota es propia avisa sin abrir el cuestionario", () => {
    renderFlow(PET, authValue({ ...USER, id: 2 }));

    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));

    expect(screen.getByText(OWN_PET_ADOPTION_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("precarga nombre y correo, que se pueden editar", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));

    const name = screen.getByLabelText("Nombre Completo *");
    expect(name).toHaveValue("Tomás Gómez");
    fireEvent.change(name, { target: { value: "Tomás A. Gómez" } });
    expect(name).toHaveValue("Tomás A. Gómez");
    expect(screen.getByLabelText("Correo Electrónico *")).toHaveValue(
      "miembro@callejeros.ar",
    );
  });

  it("no avanza de paso con datos inválidos y muestra el error junto al campo", async () => {
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));

    type("Edad *", "16");
    await clickNext();

    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
    expect(
      await screen.findByText("Para adoptar tenés que ser mayor de 18 años."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Edad *")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByText("El WhatsApp o teléfono es obligatorio."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pregunta por el alquiler solo si la vivienda es alquilada", async () => {
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    type("Edad *", "32");
    type("WhatsApp / Teléfono *", "358 4111111");
    type("Dirección *", "Sobremonte 100");
    type("Localidad *", "Río Cuarto");
    await clickNext();
    await screen.findByText("Paso 2 de 4");

    expect(
      screen.queryByRole("group", { name: /permite animales/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Alquilada"));
    expect(
      screen.getByRole("group", { name: /permite animales/ }),
    ).toBeInTheDocument();

    await clickNext();
    expect(
      await screen.findByText(
        "Indicá si el contrato o el dueño permite animales.",
      ),
    ).toBeInTheDocument();
  });

  it("conserva lo cargado al volver con Anterior", async () => {
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    await fillUntilStep4();

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("Paso 3 de 4")).toBeInTheDocument();
    expect(screen.getByLabelText(/Quién lo cuida si viajás/)).toHaveValue(
      "Mi hermana",
    );
  });

  it("pide la castración solo si la mascota no está castrada", async () => {
    renderFlow({ ...PET, is_neutered: true } as PetDetail);
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    await fillUntilStep4();

    expect(screen.queryByLabelText(/castrarlo\/a/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("envía la solicitud, deshabilita el botón mientras tanto y muestra el éxito", async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    await fillUntilStep4();
    checkAllCommitments();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Enviar Solicitud de Adopción" }),
      );
    });

    const sending = await screen.findByRole("button", {
      name: "Enviando solicitud…",
    });
    expect(sending).toBeDisabled();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/adoption-requests/");
    expect(JSON.parse(String(init.body))).toMatchObject({
      pet: 3,
      full_name: "Tomás Gómez",
      age: 32,
      home_ownership: "owned",
      rental_allows_pets: "",
      hours_alone: "4_to_8",
      accepts_neutering: true,
      declares_truthful: true,
    });

    await act(async () => {
      resolveFetch(jsonResponse(201, { id: 9, status: "pending" }));
    });

    expect(
      await screen.findByRole("dialog", {
        name: "¡Datos enviados correctamente!",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Te avisaremos en tus notificaciones si la solicitud para adoptar a Bora es aceptada.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("button", { name: "🔔 Ver mis notificaciones" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.queryByRole("dialog", { name: "Adoptar a Bora" }),
    ).not.toBeInTheDocument();
  });

  it("muestra el error de solicitud duplicada sin perder lo cargado", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        pet: ["Ya tenés una solicitud pendiente para esta mascota."],
      }),
    );
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    await fillUntilStep4();
    checkAllCommitments();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Enviar Solicitud de Adopción" }),
      );
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya tenés una solicitud pendiente para esta mascota.",
    );
    expect(screen.getByText("Paso 4 de 4")).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeChecked();
    }
    expect(
      screen.getByRole("button", { name: "Enviar Solicitud de Adopción" }),
    ).toBeEnabled();
  });

  it("si el back marca un campo, vuelve al paso de ese campo", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { email: ["Ingresá un correo electrónico válido."] }),
    );
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    await fillUntilStep4();
    checkAllCommitments();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Enviar Solicitud de Adopción" }),
      );
    });

    expect(await screen.findByText("Paso 1 de 4")).toBeInTheDocument();
    expect(
      screen.getByText("Ingresá un correo electrónico válido."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Edad *")).toHaveValue("32");
  });

  it("muestra el error de red y permite reintentar", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(201, { id: 9, status: "pending" }));
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    await fillUntilStep4();
    checkAllCommitments();

    const submit = () =>
      act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Enviar Solicitud de Adopción" }),
        );
      });

    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      ERROR_MESSAGES.network,
    );

    await submit();
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "¡Datos enviados correctamente!" }),
      ).toBeInTheDocument(),
    );
  });

  it("se cierra con la X y con Escape", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "¡Adoptame!" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

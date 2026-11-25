import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthContextValue,
} from "@/components/auth/AuthProvider";
import { PublishPetView } from "@/components/pets/PublishPetView";
import { ApiError } from "@/lib/api/client";
import * as petsApi from "@/lib/pets/api";
import {
  PET_PHOTO_FORMAT_ERROR,
  PET_PHOTO_REQUIRED_ERROR,
} from "@/lib/pets/form";
import { buildPet } from "@/lib/pets/testing";
import type { PetDetail } from "@/lib/pets/types";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  usePathname: () => "/adopciones/publicar",
}));

function makeAuthContext(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    user: {
      id: 7,
      email: "miembro@callejeros.ar",
      first_name: "Sofía",
      last_name: "Pérez",
      phone: "358 4123456",
      is_phone_verified: true,
      photo: null,
      role: { code: "member", name: "Miembro" },
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setSession: vi.fn(),
    ...overrides,
  };
}

function renderPublishView(authOverrides: Partial<AuthContextValue> = {}) {
  return render(
    <AuthContext.Provider value={makeAuthContext(authOverrides)}>
      <PublishPetView />
    </AuthContext.Provider>,
  );
}

describe("PublishPetView y PetForm", () => {
  const createPetSpy = vi.spyOn(petsApi, "createPet");
  let objectUrlCounter = 0;
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createPetSpy.mockReset();
    mockBack.mockReset();
    mockPush.mockReset();
    objectUrlCounter = 0;
    createObjectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation(() => `blob:pet-preview-${++objectUrlCounter}`);
    revokeObjectUrlSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("arranca sin castración ni sociabilidad marcadas, convivencia en Sin evaluar y cuidado especial deshabilitado", () => {
    renderPublishView();

    expect(
      screen.getByRole("heading", { name: "Publicar Mascota para Adopción" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("radio", { name: "Castrado" })).not.toBeChecked();
    expect(
      screen.getByRole("radio", { name: "No Castrado" }),
    ).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Sociable" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Salvaje" })).not.toBeChecked();

    expect(screen.getByLabelText("¿Sociable con niños? *")).toHaveValue(
      "not_evaluated",
    );
    expect(screen.getByLabelText("¿Con otros animales? *")).toHaveValue(
      "not_evaluated",
    );

    const healthTextarea = screen.getByLabelText(
      "Contá qué problema de salud tiene o qué cuidados necesita",
    );
    expect(healthTextarea).toBeDisabled();
    expect(screen.getByText("0 / 150")).toBeInTheDocument();
    expect(screen.getByText("0 / 400")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Lo ve el equipo de voluntarios y, si aprobamos una solicitud de adopción, también la persona aprobada, para coordinar el encuentro.",
      ),
    ).toBeInTheDocument();
  });

  it("valida campos obligatorios con zod y exige foto al intentar enviar vacío", async () => {
    renderPublishView({
      user: {
        ...makeAuthContext().user!,
        phone: "",
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar para revisión" }),
    );

    expect(
      await screen.findByText("El nombre de la mascota es obligatorio."),
    ).toBeInTheDocument();
    expect(screen.getByText("Indicá la edad aproximada.")).toBeInTheDocument();
    expect(
      screen.getByText("Indicá si la mascota está castrada."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Indicá si la mascota es sociable."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("El teléfono de contacto es obligatorio."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("La descripción es obligatoria."),
    ).toBeInTheDocument();
    expect(screen.getByText(PET_PHOTO_REQUIRED_ERROR)).toBeInTheDocument();
    expect(createPetSpy).not.toHaveBeenCalled();

    // Completa los campos de texto/radios pero sin foto: exige la foto junto al dropzone
    fireEvent.change(screen.getByLabelText("Nombre *"), {
      target: { value: "Manchitas" },
    });
    fireEvent.change(screen.getByLabelText("Edad aproximada *"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Castrado" }));
    fireEvent.click(screen.getByRole("radio", { name: "Sociable" }));
    fireEvent.change(screen.getByLabelText("Teléfono de contacto *"), {
      target: { value: "358 4123456" },
    });
    fireEvent.change(screen.getByLabelText("Historia y Comportamiento *"), {
      target: { value: "Rescatado en barrio Alberdi." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar para revisión" }),
    );

    expect(
      await screen.findByText(PET_PHOTO_REQUIRED_ERROR),
    ).toBeInTheDocument();
    expect(createPetSpy).not.toHaveBeenCalled();
  });

  it("habilita cuidado especial al marcar la casilla, limpia al desmarcar y actualiza contadores", () => {
    renderPublishView();

    const healthCheck = screen.getByRole("checkbox", {
      name: /Tiene un problema de salud o necesita cuidados especiales/i,
    });
    const healthTextarea = screen.getByLabelText(
      "Contá qué problema de salud tiene o qué cuidados necesita",
    );

    expect(healthTextarea).toBeDisabled();

    fireEvent.click(healthCheck);
    expect(healthTextarea).toBeEnabled();

    fireEvent.change(healthTextarea, {
      target: { value: "Medicación diaria" },
    });
    expect(screen.getByText("17 / 150")).toBeInTheDocument();

    fireEvent.click(healthCheck);
    expect(healthTextarea).toBeDisabled();
    expect(healthTextarea).toHaveValue("");
    expect(screen.getByText("0 / 150")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Historia y Comportamiento *"), {
      target: { value: "Muy cariñoso" },
    });
    expect(screen.getByText("12 / 400")).toBeInTheDocument();
  });

  it("permite previsualizar y quitar fotos y rechaza formatos inválidos", () => {
    renderPublishView();

    const fileInput = screen.getByLabelText("Foto de la Mascota *");
    const validFile = new File(["jpg-bytes"], "manchitas.jpg", {
      type: "image/jpeg",
    });
    const invalidFile = new File(["gif-bytes"], "anim.gif", {
      type: "image/gif",
    });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    expect(screen.getByText(PET_PHOTO_FORMAT_ERROR)).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [validFile] } });
    expect(screen.queryByText(PET_PHOTO_FORMAT_ERROR)).not.toBeInTheDocument();
    expect(screen.getByText("✓ Foto lista para publicar")).toBeInTheDocument();
    expect(
      screen.getByAltText("Previsualización de foto 1: manchitas.jpg"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar foto 1" }));
    expect(
      screen.queryByText("✓ Foto lista para publicar"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Subir foto de la mascota")).toBeInTheDocument();
  });

  it("deshabilita el botón con 'Publicando...' al enviar y muestra confirmación de revisión", async () => {
    let resolveCreate!: (value: PetDetail) => void;
    createPetSpy.mockReturnValueOnce(
      new Promise<PetDetail>((resolve) => {
        resolveCreate = resolve;
      }),
    );

    renderPublishView();

    fireEvent.change(screen.getByLabelText("Nombre *"), {
      target: { value: "Manchitas" },
    });
    fireEvent.change(screen.getByLabelText("Edad aproximada *"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Castrado" }));
    fireEvent.click(screen.getByRole("radio", { name: "Sociable" }));
    fireEvent.change(screen.getByLabelText("Historia y Comportamiento *"), {
      target: { value: "Muy dócil y juguetón." },
    });

    const photo = new File(["img"], "manchitas.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Foto de la Mascota *"), {
      target: { files: [photo] },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar para revisión" }),
    );

    const submittingBtn = await screen.findByRole("button", {
      name: "Publicando...",
    });
    expect(submittingBtn).toBeDisabled();

    resolveCreate(buildPet({ id: 42, name: "Manchitas", status: "in_review" }));

    expect(
      await screen.findByRole("heading", { name: "¡Publicación enviada!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Un voluntario va a revisar la publicación de Manchitas/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver ficha de Manchitas" }),
    ).toHaveAttribute("href", "/mascotas/42");
    expect(
      screen.getByRole("link", { name: "Ir al catálogo" }),
    ).toHaveAttribute("href", "/adopciones");

    const sentFormData = createPetSpy.mock.calls[0]?.[0];
    expect(sentFormData).toBeInstanceOf(FormData);
    expect(sentFormData?.get("name")).toBe("Manchitas");
    expect(sentFormData?.getAll("photos")).toEqual([photo]);

    // Permite volver a publicar otra mascota
    fireEvent.click(
      screen.getByRole("button", { name: "Publicar otra mascota" }),
    );
    expect(
      screen.getByRole("heading", { name: "Publicar Mascota para Adopción" }),
    ).toBeInTheDocument();
  });

  it("muestra confirmación directa cuando el back devuelve status published (Admin)", async () => {
    createPetSpy.mockResolvedValueOnce(
      buildPet({ id: 55, name: "Toby", status: "published" }),
    );

    renderPublishView();

    fireEvent.change(screen.getByLabelText("Nombre *"), {
      target: { value: "Toby" },
    });
    fireEvent.change(screen.getByLabelText("Edad aproximada *"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "No Castrado" }));
    fireEvent.click(screen.getByRole("radio", { name: "Sociable" }));
    fireEvent.change(screen.getByLabelText("Historia y Comportamiento *"), {
      target: { value: "Listo para adopción." },
    });
    fireEvent.change(screen.getByLabelText("Foto de la Mascota *"), {
      target: {
        files: [new File(["img"], "toby.webp", { type: "image/webp" })],
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar para revisión" }),
    );

    expect(
      await screen.findByRole("heading", { name: "¡Mascota publicada!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /La publicación de Toby ya está visible en el catálogo/i,
      ),
    ).toBeInTheDocument();
  });

  it("muestra los errores por campo devueltos por el back debajo de cada campo", async () => {
    createPetSpy.mockRejectedValueOnce(
      new ApiError(400, "Revisá los datos marcados.", {
        contact_phone: ["Ingresá un teléfono válido."],
        photos: ["El archivo está dañado."],
      }),
    );

    renderPublishView();

    fireEvent.change(screen.getByLabelText("Nombre *"), {
      target: { value: "Luna" },
    });
    fireEvent.change(screen.getByLabelText("Edad aproximada *"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Castrado" }));
    fireEvent.click(screen.getByRole("radio", { name: "Salvaje" }));
    fireEvent.change(screen.getByLabelText("Historia y Comportamiento *"), {
      target: { value: "Gatita rescatada." },
    });
    fireEvent.change(screen.getByLabelText("Foto de la Mascota *"), {
      target: {
        files: [new File(["img"], "luna.jpg", { type: "image/jpeg" })],
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar para revisión" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Ingresá un teléfono válido."),
      ).toBeInTheDocument();
      expect(screen.getByText("El archivo está dañado.")).toBeInTheDocument();
    });
  });
});

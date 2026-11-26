import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthContextValue,
} from "@/components/auth/AuthProvider";
import { EditPetView } from "@/components/pets/EditPetView";
import { ApiError } from "@/lib/api/client";
import * as petsApi from "@/lib/pets/api";
import { PET_PHOTO_FORMAT_ERROR } from "@/lib/pets/form";
import { buildPet } from "@/lib/pets/testing";
import type { PetDetail } from "@/lib/pets/types";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  usePathname: () => "/mis-publicaciones/1/editar",
}));

function makeAuthContext(
  roleCode: "member" | "staff" | "admin" = "member",
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
      role: { code: roleCode, name: roleCode },
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setSession: vi.fn(),
  };
}

function renderEditView(
  rawId = "1",
  roleCode: "member" | "staff" | "admin" = "member",
) {
  return render(
    <AuthContext.Provider value={makeAuthContext(roleCode)}>
      <EditPetView rawId={rawId} />
    </AuthContext.Provider>,
  );
}

describe("EditPetView y PetPhotosManager", () => {
  const fetchPetByIdSpy = vi.spyOn(petsApi, "fetchPetById");
  const updatePetSpy = vi.spyOn(petsApi, "updatePet");
  const addPetPhotoSpy = vi.spyOn(petsApi, "addPetPhoto");
  const deletePetPhotoSpy = vi.spyOn(petsApi, "deletePetPhoto");

  beforeEach(() => {
    fetchPetByIdSpy.mockReset();
    updatePetSpy.mockReset();
    addPetPhotoSpy.mockReset();
    deletePetPhotoSpy.mockReset();
    mockBack.mockReset();
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("muestra LoadingScreen, precarga el formulario y avisa al autor que editar una publicada vuelve a revisión", async () => {
    let resolvePet!: (value: PetDetail) => void;
    fetchPetByIdSpy.mockReturnValueOnce(
      new Promise<PetDetail>((resolve) => {
        resolvePet = resolve;
      }),
    );

    renderEditView("1", "member");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando publicación...",
    );

    resolvePet(
      buildPet({
        id: 1,
        name: "Loki",
        status: "published",
        contact_phone: "358 4123456",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Editar a Loki" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Loki");
    expect(screen.getByRole("note")).toHaveTextContent(
      /volverá a estado «En revisión»/i,
    );
    // Con una sola foto, el botón eliminar está deshabilitado
    expect(
      screen.getByRole("button", { name: "Eliminar foto 1" }),
    ).toBeDisabled();
  });

  it("bloquea edición y gestión de fotos si la publicación está rechazada", async () => {
    fetchPetByIdSpy.mockResolvedValueOnce(
      buildPet({ id: 5, name: "Toto", status: "rejected" }),
    );

    renderEditView("5", "member");

    expect(
      await screen.findByRole("heading", { name: "Publicación rechazada" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Guardar cambios" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Cargar nueva publicación" }),
    ).toHaveAttribute("href", "/adopciones/publicar");
  });

  it("muestra not_found con ID inválido o 404 y permite reintentar ante error 500", async () => {
    renderEditView("abc");
    expect(
      screen.getByRole("heading", {
        name: "No encontramos esta publicación",
      }),
    ).toBeInTheDocument();
    expect(fetchPetByIdSpy).not.toHaveBeenCalled();

    fetchPetByIdSpy
      .mockRejectedValueOnce(new ApiError(500, "Error interno."))
      .mockResolvedValueOnce(
        buildPet({ id: 2, name: "Bora", status: "in_review" }),
      );

    renderEditView("2");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error interno.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("heading", { name: "Editar a Bora" }),
    ).toBeInTheDocument();
  });

  it("guarda cambios con botón en gerundio y avisa cuando la publicación vuelve a revisión", async () => {
    let resolveUpdate!: (value: PetDetail) => void;
    updatePetSpy.mockReturnValueOnce(
      new Promise<PetDetail>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const original = buildPet({
      id: 1,
      name: "Loki",
      status: "published",
      contact_phone: "358 4123456",
    });
    fetchPetByIdSpy.mockResolvedValueOnce(original);

    renderEditView("1", "member");
    await screen.findByRole("heading", { name: "Editar a Loki" });

    fireEvent.change(screen.getByLabelText("Nombre *"), {
      target: { value: "Loki Actualizado" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByRole("button", { name: "Guardando..." }),
    ).toBeDisabled();

    resolveUpdate({
      ...original,
      name: "Loki Actualizado",
      status: "in_review",
      updated_at: "2026-11-26T16:00:00Z",
    });

    expect(
      await screen.findByText(
        "Cambios guardados. La publicación volvió a «En revisión» hasta que un voluntario la apruebe.",
      ),
    ).toBeInTheDocument();
    expect(updatePetSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "Loki Actualizado" }),
    );
  });

  it("permite agregar y eliminar fotos del carrusel y valida formato en cliente", async () => {
    const petWithTwoPhotos = buildPet({
      id: 1,
      name: "Loki",
      status: "published",
      contact_phone: "358 4123456",
      photos: [
        {
          id: 10,
          image: "/media/pets/loki-1.jpg",
          position: 0,
          created_at: "2026-11-20T12:00:00Z",
        },
        {
          id: 11,
          image: "/media/pets/loki-2.jpg",
          position: 1,
          created_at: "2026-11-20T12:05:00Z",
        },
      ],
    });
    const petAfterAdd = {
      ...petWithTwoPhotos,
      status: "in_review" as const,
      photos: [
        ...petWithTwoPhotos.photos,
        {
          id: 12,
          image: "/media/pets/loki-3.png",
          position: 2,
          created_at: "2026-11-26T16:10:00Z",
        },
      ],
    };
    const petAfterDelete = {
      ...petAfterAdd,
      photos: [petAfterAdd.photos[0], petAfterAdd.photos[2]],
    };

    fetchPetByIdSpy
      .mockResolvedValueOnce(petWithTwoPhotos)
      .mockResolvedValueOnce(petAfterAdd)
      .mockResolvedValueOnce(petAfterDelete);

    addPetPhotoSpy.mockResolvedValueOnce(petAfterAdd.photos[2]);
    deletePetPhotoSpy.mockResolvedValueOnce();

    renderEditView("1", "member");
    await screen.findByRole("heading", { name: "Fotos de Loki (2)" });

    // Formato inválido en cliente
    const fileInput = screen.getByLabelText("Agregar nueva foto");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["gif"], "anim.gif", { type: "image/gif" })],
      },
    });
    expect(screen.getByText(PET_PHOTO_FORMAT_ERROR)).toBeInTheDocument();
    expect(addPetPhotoSpy).not.toHaveBeenCalled();

    // Sube foto válida
    const validFile = new File(["png"], "loki-3.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(
      await screen.findByText(
        "Foto agregada al carrusel. La publicación volvió a «En revisión» hasta que un voluntario la apruebe.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fotos de Loki (3)" }),
    ).toBeInTheDocument();

    // Elimina la segunda foto
    fireEvent.click(screen.getByRole("button", { name: "Eliminar foto 2" }));

    await waitFor(() => {
      expect(deletePetPhotoSpy).toHaveBeenCalledWith(1, 11);
    });
    expect(
      await screen.findByText("Foto eliminada del carrusel."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fotos de Loki (2)" }),
    ).toBeInTheDocument();
  });
});

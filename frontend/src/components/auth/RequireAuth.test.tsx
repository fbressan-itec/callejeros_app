import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { type AuthTokenResponse, saveAuthSession } from "@/lib/auth/session";

const replaceMock = vi.fn();
const fetchMock = vi.fn();
let currentPathname = "/alertas/reportar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: replaceMock,
  }),
  usePathname: () => currentPathname,
}));

const MOCK_USER_SESSION: AuthTokenResponse = {
  access: "access-token",
  refresh: "refresh-token",
  user: {
    id: 5,
    email: "miembro@callejeros.ar",
    first_name: "Ana",
    last_name: "Ruiz",
    phone: "3584112233",
    is_phone_verified: true,
    photo: null,
    role: {
      code: "member",
      name: "Miembro",
    },
  },
};

describe("RequireAuth y AuthRequiredModal", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
    vi.stubGlobal("fetch", fetchMock);
    replaceMock.mockReset();
    fetchMock.mockReset();
    currentPathname = "/alertas/reportar";
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("RequireAuth redirige a /login?redirect=<origen> cuando no hay sesión", async () => {
    render(
      <AuthProvider>
        <RequireAuth>
          <div>Contenido protegido</div>
        </RequireAuth>
      </AuthProvider>,
    );

    expect(screen.queryByText("Contenido protegido")).toBeNull();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/login?redirect=%2Falertas%2Freportar",
      );
    });
  });

  it("RequireAuth renderiza el contenido si hay sesión activa con rol permitido y redirige a / si falta rol", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(MOCK_USER_SESSION.user), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    saveAuthSession(MOCK_USER_SESSION, false);

    const { rerender } = render(
      <AuthProvider>
        <RequireAuth>
          <div>Contenido protegido</div>
        </RequireAuth>
      </AuthProvider>,
    );

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();

    rerender(
      <AuthProvider>
        <RequireAuth allowedRoles={["staff"]}>
          <div>Panel de Staff</div>
        </RequireAuth>
      </AuthProvider>,
    );

    expect(screen.queryByText("Panel de Staff")).toBeNull();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("AuthRequiredModal muestra los enlaces a login y registro preservando la página de origen y cierra con Escape", () => {
    const onClose = vi.fn();
    currentPathname = "/adopciones";

    render(<AuthRequiredModal isOpen={true} onClose={onClose} />);

    expect(
      screen.getByRole("heading", { name: "Iniciá sesión para continuar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar Sesión" }),
    ).toHaveAttribute("href", "/login?redirect=%2Fadopciones");
    expect(
      screen.getByRole("link", { name: "Crear Cuenta / Registrarme" }),
    ).toHaveAttribute("href", "/registro?redirect=%2Fadopciones");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "./AppHeader";
import { MobileMenu } from "./MobileMenu";

let currentPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

describe("MobileMenu y AppHeader", () => {
  beforeEach(() => {
    currentPathname = "/";
    document.body.className = "";
  });

  it("abre y cierra el menú desde el botón hamburguesa, controla inert y bloquea el scroll del body", () => {
    render(<AppHeader />);

    const menuButton = screen.getByRole("button", {
      name: "Abrir menú de navegación",
    });
    const nav = document.getElementById("mobile-menu");

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(nav).toHaveAttribute("inert");
    expect(document.body.classList.contains("overflow-hidden")).toBe(false);

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(nav).not.toHaveAttribute("inert");
    expect(document.body.classList.contains("overflow-hidden")).toBe(true);

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(nav).toHaveAttribute("inert");
    expect(document.body.classList.contains("overflow-hidden")).toBe(false);
  });

  it("cierra el menú al presionar Escape, al tocar el backdrop o al elegir un enlace", () => {
    render(<AppHeader />);

    const menuButton = screen.getByRole("button", {
      name: "Abrir menú de navegación",
    });

    // Cierre con Escape y retorno del foco al botón hamburguesa
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    screen.getByRole("link", { name: "Adoptar" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(menuButton);

    // Cierre al tocar el backdrop
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const backdrop = document.getElementById("menu-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    // Cierre al elegir un enlace
    fireEvent.click(menuButton);
    const link = screen.getByRole("link", { name: "Adoptar" });
    fireEvent.click(link);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("muestra los 4 grupos del maquetado y resalta la sección activa sin marcar enlaces con hash", () => {
    currentPathname = "/adopciones";
    render(<MobileMenu isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Adoptá un Callejero" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Noticias" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Información" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Quiero Colaborar" }),
    ).toBeInTheDocument();

    const adoptarLink = screen.getByRole("link", { name: "Adoptar" });
    const publicarLink = screen.getByRole("link", { name: "Publicar" });
    const alertaLink = screen.getByRole("link", {
      name: "🚨 Alerta Callejero!",
    });

    expect(adoptarLink).toHaveAttribute("aria-current", "page");
    expect(adoptarLink.className).toContain("ring-2 ring-orange-500");
    expect(publicarLink).not.toHaveAttribute("aria-current");
    expect(alertaLink).not.toHaveAttribute("aria-current");
  });

  it("agrupa el detalle de una noticia bajo la sección Noticias", () => {
    currentPathname = "/noticias/jornada-adopcion";
    render(<MobileMenu isOpen={true} onClose={vi.fn()} />);

    const noticiasLink = screen.getByRole("link", {
      name: "Eventos Benéficos y Noticias",
    });
    expect(noticiasLink).toHaveAttribute("aria-current", "page");
  });

  it("muestra el bloque No Registrado sin sesión, y el perfil con insignia de rol y cierre de sesión con cuenta activa", () => {
    const onClose = vi.fn();
    const onLogout = vi.fn();

    const { rerender } = render(<MobileMenu isOpen={true} onClose={onClose} />);

    expect(screen.getByText("No Registrado...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Registrarme" })).toHaveAttribute(
      "href",
      "/registro",
    );
    expect(
      screen.getByRole("link", { name: "Iniciar Sesión" }),
    ).toHaveAttribute("href", "/login");
    expect(screen.queryByText(/Alternar Modo Test/i)).toBeNull();

    // Con sesión de Refugio verificado
    rerender(
      <MobileMenu
        isOpen={true}
        onClose={onClose}
        onLogout={onLogout}
        user={{ name: "Patitas Sur", role: "verified_shelter" }}
      />,
    );

    expect(screen.getByText("¡Hola, Patitas Sur!")).toBeInTheDocument();
    expect(screen.getByText("✓ Refugio verificado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "⚙️ Mi cuenta" })).toHaveAttribute(
      "href",
      "/mi-cuenta",
    );

    // Con sesión de Staff
    rerender(
      <MobileMenu
        isOpen={true}
        onClose={onClose}
        onLogout={onLogout}
        user={{ name: "Laura", role: "staff" }}
      />,
    );

    expect(screen.getByText("¡Hola, Laura!")).toBeInTheDocument();
    expect(screen.getByText("🛡️ Staff Callejeros")).toBeInTheDocument();

    const logoutButton = screen.getByRole("button", { name: "Cerrar Sesión" });
    fireEvent.click(logoutButton);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

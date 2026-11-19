import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Navbar } from "./Navbar";

const setThemeMock = vi.fn();
let currentResolvedTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: currentResolvedTheme,
    setTheme: setThemeMock,
  }),
}));

describe("Navbar", () => {
  beforeEach(() => {
    setThemeMock.mockClear();
    currentResolvedTheme = "light";
  });

  it("muestra el logo con enlace al inicio y los tres botones de control con tamaño mínimo de 44px", () => {
    render(<Navbar />);

    const homeLink = screen.getByRole("link", {
      name: "Ir al inicio - Callejeros Río Cuarto",
    });
    expect(homeLink).toHaveAttribute("href", "/");
    expect(screen.getByAltText("Logo Callejeros Río IV")).toBeInTheDocument();

    const notifButton = screen.getByRole("button", {
      name: "Ver alertas y notificaciones",
    });
    const themeButton = screen.getByRole("button", {
      name: "Cambiar entre modo claro y oscuro",
    });
    const menuButton = screen.getByRole("button", {
      name: "Abrir menú de navegación",
    });

    for (const button of [notifButton, themeButton, menuButton]) {
      expect(button.className).toContain("min-w-[44px]");
      expect(button.className).toContain("min-h-[44px]");
      expect(button.className).toContain("focus-visible:ring-2");
    }
  });

  it("alterna entre modo claro y oscuro al presionar el botón de tema", () => {
    const { rerender } = render(<Navbar />);

    const themeButton = screen.getByRole("button", {
      name: "Cambiar entre modo claro y oscuro",
    });

    fireEvent.click(themeButton);
    expect(setThemeMock).toHaveBeenCalledWith("dark");

    currentResolvedTheme = "dark";
    rerender(<Navbar />);

    fireEvent.click(themeButton);
    expect(setThemeMock).toHaveBeenLastCalledWith("light");
  });

  it("muestra el contador de notificaciones solo cuando hay no leídas y refleja aria-expanded en los botones", () => {
    const onMenuToggle = vi.fn();
    const onNotificationsToggle = vi.fn();

    const { rerender } = render(
      <Navbar
        unreadNotificationsCount={0}
        isMenuOpen={false}
        isNotificationsOpen={false}
        onMenuToggle={onMenuToggle}
        onNotificationsToggle={onNotificationsToggle}
      />,
    );

    expect(document.getElementById("notif-badge-count")).toBeNull();

    const menuButton = screen.getByRole("button", {
      name: "Abrir menú de navegación",
    });
    const notifButton = screen.getByRole("button", {
      name: "Ver alertas y notificaciones",
    });

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(notifButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);
    fireEvent.click(notifButton);
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
    expect(onNotificationsToggle).toHaveBeenCalledTimes(1);

    rerender(
      <Navbar
        unreadNotificationsCount={3}
        isMenuOpen={true}
        isNotificationsOpen={true}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(notifButton).toHaveAttribute("aria-expanded", "true");
  });
});

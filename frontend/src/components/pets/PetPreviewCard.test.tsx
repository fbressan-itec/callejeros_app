import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PetPreviewCard } from "@/components/pets/PetPreviewCard";
import { buildPet } from "@/lib/pets/testing";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test/api");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 23));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("PetPreviewCard", () => {
  it("muestra foto, etiqueta, nombre, resumen, descripción y el acceso a la ficha", () => {
    render(<PetPreviewCard pet={buildPet({ id: 7 })} />);

    expect(screen.getByRole("img", { name: "Loki" })).toHaveAttribute(
      "src",
      "http://api.test/media/pets/loki-1.jpg",
    );
    expect(screen.getByText("Sociable")).toHaveClass("bg-emerald-700");
    expect(
      screen.getByRole("heading", { level: 3, name: "Loki" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 Años • Castrado")).toBeInTheDocument();
    expect(screen.getByText(/Rescatado en barrio Alberdi/)).toHaveClass(
      "line-clamp-2",
    );

    const link = screen.getByRole("link", { name: "Conocer a Loki" });
    expect(link).toHaveAttribute("href", "/mascotas/7");
    expect(link).toHaveClass("min-h-[44px]");
  });

  it("marca como Salvaje a una mascota no sociable", () => {
    render(
      <PetPreviewCard
        pet={buildPet({ name: "Misa", is_sociable: false, sex: "female" })}
      />,
    );

    expect(screen.getByText("Salvaje")).toHaveClass(
      "bg-amber-500",
      "text-amber-950",
    );
  });

  it("sin fotos muestra un lugar vacío en vez de una imagen rota", () => {
    render(<PetPreviewCard pet={buildPet({ photos: [] })} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("🐾")).toBeInTheDocument();
  });
});

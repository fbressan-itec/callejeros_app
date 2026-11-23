import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PetPhotoCarousel } from "@/components/pets/PetPhotoCarousel";
import type { PetPhoto } from "@/lib/pets/types";

const PHOTOS: PetPhoto[] = [
  {
    id: 2,
    image: "https://cdn.test/loki-2.jpg",
    position: 1,
    created_at: "2026-11-20T12:00:00Z",
  },
  {
    id: 1,
    image: "https://cdn.test/loki-1.jpg",
    position: 0,
    created_at: "2026-11-20T12:00:00Z",
  },
  {
    id: 3,
    image: "https://cdn.test/loki-3.jpg",
    position: 2,
    created_at: "2026-11-20T12:00:00Z",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PetPhotoCarousel", () => {
  it("con una sola foto no muestra contador, flechas ni puntitos", () => {
    render(
      <PetPhotoCarousel
        petName="Luna"
        description="Gatita muy dulce y tranquila."
        photos={[PHOTOS[1]]}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Foto 1 de 1 de Luna" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Gatita muy dulce y tranquila."),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Foto siguiente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Elegir foto" }),
    ).not.toBeInTheDocument();
  });

  it("ordena varias fotos por position y permite navegar con flechas y puntitos de 44×44 px", () => {
    render(
      <PetPhotoCarousel
        petName="Loki"
        description="Perrito juguetón y sociable."
        photos={PHOTOS}
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute("src", "https://cdn.test/loki-1.jpg");
    expect(images[1]).toHaveAttribute("src", "https://cdn.test/loki-2.jpg");
    expect(images[2]).toHaveAttribute("src", "https://cdn.test/loki-3.jpg");

    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    const dot1 = screen.getByRole("button", { name: "Ver foto 1" });
    const dot3 = screen.getByRole("button", { name: "Ver foto 3" });
    expect(dot1.className).toContain("min-w-[44px]");
    expect(dot1.className).toContain("min-h-[44px]");
    expect(dot1).toHaveAttribute("aria-current", "true");
    expect(dot3).toHaveAttribute("aria-current", "false");

    fireEvent.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.click(dot3);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(dot3).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "Foto anterior" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it('muestra el botón "Ver más" solo cuando el resumen se corta y ejecuta onSeeMore', () => {
    const onSeeMore = vi.fn();
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(90);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);

    render(
      <PetPhotoCarousel
        petName="Loki"
        description="Descripción larga que supera las dos líneas visibles sobre el degradado inferior del carrusel."
        photos={[PHOTOS[1]]}
        onSeeMore={onSeeMore}
      />,
    );

    const seeMoreBtn = screen.getByRole("button", { name: "Ver más" });
    expect(seeMoreBtn).toBeInTheDocument();
    fireEvent.click(seeMoreBtn);
    expect(onSeeMore).toHaveBeenCalledTimes(1);
  });
});

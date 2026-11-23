import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PetCard } from "@/components/pets/PetCard";
import { buildPet } from "@/lib/pets/testing";

describe("PetCard", () => {
  it("muestra datos principales, sociabilidad, urgente y enlace a la ficha", () => {
    const pet = buildPet({
      id: 7,
      name: "Rocco",
      sex: "male",
      is_sociable: false,
      is_neutered: true,
      is_urgent: true,
      is_favorite: false,
      estimated_birth_date: "2022-05-10",
    });

    render(<PetCard pet={pet} />);

    expect(screen.getByRole("heading", { name: "Rocco" })).toBeInTheDocument();
    expect(screen.getByText("Macho")).toBeInTheDocument();
    expect(screen.getByText("Salvaje")).toBeInTheDocument();
    expect(screen.getByText("🚨 Caso Urgente")).toBeInTheDocument();
    expect(screen.getByText(/Castrado/)).toBeInTheDocument();

    const adoptLink = screen.getByRole("link", { name: /Adoptar/i });
    expect(adoptLink).toHaveAttribute("href", "/mascotas/7");
  });

  it("muestra insignia de adoptada en lugar de urgente cuando status es adopted", () => {
    const pet = buildPet({
      id: 9,
      name: "Pancho",
      status: "adopted",
      is_urgent: true,
    });

    render(<PetCard pet={pet} />);

    expect(screen.getByText("¡Ya encontró hogar! 🧡")).toBeInTheDocument();
    expect(screen.queryByText("🚨 Caso Urgente")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver historia/i })).toHaveAttribute(
      "href",
      "/mascotas/9",
    );
  });

  it("refleja el estado de favorito y dispara onToggleFavorite al hacer clic", () => {
    const onToggleFavorite = vi.fn();
    const pet = buildPet({ id: 3, name: "Luna", is_favorite: true });

    render(<PetCard pet={pet} onToggleFavorite={onToggleFavorite} />);

    const favButton = screen.getByRole("button", {
      name: "Quitar a Luna de favoritos",
    });
    expect(favButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(favButton);
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).toHaveBeenCalledWith(pet);
  });

  it("muestra fallback visual cuando la mascota no tiene fotos", () => {
    const pet = buildPet({ name: "SinFoto", photos: [] });

    render(<PetCard pet={pet} />);

    expect(screen.getByText("🐾")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

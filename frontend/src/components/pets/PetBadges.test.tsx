import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PetBadges } from "@/components/pets/PetBadges";
import type { PetBadge } from "@/lib/pets/types";

const SAMPLE_BADGES: PetBadge[] = [
  {
    key: "urgent",
    tone: "urgent",
    icon: "urgent",
    text: "Caso urgente: su tránsito vence pronto o necesita atención prioritaria.",
  },
  { key: "species", tone: "neutral", icon: "dog", text: "Perro" },
  { key: "sex", tone: "sky", icon: "male", text: "Macho" },
  {
    key: "age",
    tone: "orange",
    icon: "age_adulto",
    text: "Adulto (de 1 a 7 años): 2 Años",
  },
  {
    key: "sociability",
    tone: "green",
    icon: "sociable",
    text: "Sociable: se lleva bien con las personas.",
  },
  {
    key: "children",
    tone: "gray",
    icon: "children",
    text: "Con niños: sin evaluar todavía. Consultá con el rescatista.",
  },
  {
    key: "animals",
    tone: "amber",
    icon: "animals",
    text: "No es sociable con otros animales: mejor un hogar donde sea el único.",
  },
  {
    key: "neutered",
    tone: "amber",
    icon: "not_neutered",
    text: "Sin castrar: se entrega con compromiso de castración.",
  },
  {
    key: "special_care",
    tone: "blue",
    icon: "health",
    text: "Necesita cuidados de salud: Medicación diaria",
  },
];

describe("PetBadges", () => {
  it("muestra el texto inicial y actualiza la leyenda al tocar, pasar el mouse o enfocar una insignia", () => {
    render(<PetBadges petName="Rocco" badges={SAMPLE_BADGES} />);

    const caption = screen.getByText(
      "Tocá una insignia para ver qué significa",
    );
    expect(caption).toHaveAttribute("aria-live", "polite");

    const urgentBtn = screen.getByRole("button", {
      name: "Caso urgente: su tránsito vence pronto o necesita atención prioritaria.",
    });
    expect(urgentBtn.className).toContain("w-12");
    expect(urgentBtn.className).toContain("h-12");
    expect(urgentBtn.className).toContain("bg-rose-600");

    fireEvent.click(urgentBtn);
    expect(caption).toHaveTextContent(
      "Caso urgente: su tránsito vence pronto o necesita atención prioritaria.",
    );
    expect(urgentBtn).toHaveAttribute("aria-pressed", "true");

    const ageBtn = screen.getByRole("button", {
      name: "Adulto (de 1 a 7 años): 2 Años",
    });
    fireEvent.mouseEnter(ageBtn);
    expect(caption).toHaveTextContent("Adulto (de 1 a 7 años): 2 Años");

    const healthBtn = screen.getByRole("button", {
      name: "Necesita cuidados de salud: Medicación diaria",
    });
    fireEvent.focus(healthBtn);
    expect(caption).toHaveTextContent(
      "Necesita cuidados de salud: Medicación diaria",
    );
  });

  it('renderiza la insignia "¡Ya encontró hogar! 🧡" cuando la mascota está adoptada', () => {
    const adoptedBadges: PetBadge[] = [
      {
        key: "adopted",
        tone: "orange",
        icon: "adopted",
        text: "¡Ya encontró hogar! 🧡",
      },
      { key: "species", tone: "neutral", icon: "dog", text: "Perro" },
    ];

    render(<PetBadges petName="Pancho" badges={adoptedBadges} />);

    const adoptedBtn = screen.getByRole("button", {
      name: "¡Ya encontró hogar! 🧡",
    });
    fireEvent.click(adoptedBtn);
    expect(screen.getByText("¡Ya encontró hogar! 🧡")).toBeInTheDocument();
  });
});

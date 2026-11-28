import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CatalogFiltersModal,
  countActiveCatalogFilters,
  DEFAULT_CATALOG_FILTERS,
  type CatalogFilters,
} from "@/components/pets/CatalogFiltersModal";

describe("countActiveCatalogFilters", () => {
  it("cuenta 0 para los filtros por defecto y suma cada filtro activo", () => {
    expect(countActiveCatalogFilters(DEFAULT_CATALOG_FILTERS)).toBe(0);

    const active: CatalogFilters = {
      search: "Loki",
      ageGroup: "cachorro",
      sociability: "sociable",
      goodWithChildren: true,
      goodWithAnimals: false,
      neutered: "neutered",
      onlyUrgent: true,
      sex: "male",
      onlyFavorites: true,
      adopted: true,
    };
    expect(countActiveCatalogFilters(active)).toBe(9);
  });
});

describe("CatalogFiltersModal", () => {
  it("no renderiza nada cuando isOpen es false", () => {
    render(
      <CatalogFiltersModal
        isOpen={false}
        initialFilters={DEFAULT_CATALOG_FILTERS}
        onApply={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("aplica todos los filtros seleccionados (incluyendo Adoptados y edad única) al confirmar", () => {
    const onApply = vi.fn();

    render(
      <CatalogFiltersModal
        isOpen={true}
        initialFilters={DEFAULT_CATALOG_FILTERS}
        onApply={onApply}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Buscar ..."), {
      target: { value: "  Rocco  " },
    });

    // Selección única sobre los 3 switches de edad: activar Adulto desmarca Cachorro
    const cachorroCheckbox = screen.getByLabelText(/Cachorro/i);
    const adultoCheckbox = screen.getByLabelText(/Adulto/i);
    fireEvent.click(cachorroCheckbox);
    expect(cachorroCheckbox).toBeChecked();
    fireEvent.click(adultoCheckbox);
    expect(cachorroCheckbox).not.toBeChecked();
    expect(adultoCheckbox).toBeChecked();

    fireEvent.click(screen.getByLabelText("Salvaje"));
    fireEvent.click(screen.getByLabelText("Sociable con niños"));
    fireEvent.click(screen.getByLabelText("Sociable con otros animales"));
    fireEvent.click(screen.getByLabelText("Castrados"));
    fireEvent.click(screen.getByLabelText(/Solo Casos Urgentes/i));
    fireEvent.click(screen.getByLabelText("Macho"));
    fireEvent.click(screen.getByLabelText("Favoritos"));
    fireEvent.click(screen.getByLabelText(/Adoptados/i));

    fireEvent.click(screen.getByRole("button", { name: "VER RESULTADOS" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({
      search: "Rocco",
      ageGroup: "adulto",
      sociability: "wild",
      goodWithChildren: true,
      goodWithAnimals: true,
      neutered: "neutered",
      onlyUrgent: true,
      sex: "male",
      onlyFavorites: true,
      adopted: true,
    });
  });

  it("cierra con Escape, clic en el backdrop o botón X y limpia con Limpiar Filtros", () => {
    const onClose = vi.fn();
    const onReset = vi.fn();

    render(
      <CatalogFiltersModal
        isOpen={true}
        initialFilters={DEFAULT_CATALOG_FILTERS}
        onApply={vi.fn()}
        onReset={onReset}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar filtros de búsqueda" }),
    );
    expect(onClose).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar Filtros" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

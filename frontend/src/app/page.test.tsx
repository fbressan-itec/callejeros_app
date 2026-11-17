import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Inicio provisorio", () => {
  it("muestra el nombre del proyecto como título principal", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Callejeros Río Cuarto" }),
    ).toBeInTheDocument();
  });

  it("avisa que el sitio está en construcción", () => {
    render(<Home />);

    expect(screen.getByText("Sitio en construcción")).toBeInTheDocument();
  });
});

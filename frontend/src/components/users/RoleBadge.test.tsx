import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoleBadge } from "@/components/users/RoleBadge";

describe("RoleBadge", () => {
  it.each([
    ["member", "🐾 Miembro de la comunidad"],
    ["verified_shelter", "Refugio verificado"],
    ["staff", "🛡️Staff Callejeros"],
    ["admin", "🛡️Admin"],
  ] as const)("muestra la insignia de %s", (role, text) => {
    const { container } = render(<RoleBadge role={role} />);
    expect(container).toHaveTextContent(text);
  });

  it("oculta el ícono a los lectores de pantalla", () => {
    render(<RoleBadge role="staff" />);
    expect(screen.getByText("🛡️")).toHaveAttribute("aria-hidden", "true");
  });
});

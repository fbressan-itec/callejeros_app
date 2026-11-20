import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Desmonta lo que dibujó cada test para que no se mezcle con el siguiente.
afterEach(() => {
  cleanup();
});

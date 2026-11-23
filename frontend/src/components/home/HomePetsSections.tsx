"use client";

import { AboutSection } from "@/components/home/AboutSection";
import {
  HOME_PETS_LIMIT,
  LatestPetsSection,
} from "@/components/home/LatestPetsSection";
import { useLatestPets } from "@/lib/pets/useLatestPets";

/**
 * "Adoptá un Callejero" y "Sobre Nosotros" del inicio comparten un solo pedido a la API:
 * las mascotas más nuevas y el total de publicadas (`count`) para el contador.
 */
export function HomePetsSections() {
  const state = useLatestPets(HOME_PETS_LIMIT);
  const publishedPetsCount =
    state.status === "success" ? state.publishedCount : null;

  return (
    <>
      <LatestPetsSection state={state} />
      <AboutSection publishedPetsCount={publishedPetsCount} />
    </>
  );
}

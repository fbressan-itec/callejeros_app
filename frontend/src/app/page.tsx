import type { Metadata } from "next";

import { AboutSection } from "@/components/home/AboutSection";
import { CollaborateSection } from "@/components/home/CollaborateSection";
import { HeroCarousel } from "@/components/home/HeroCarousel";

// Título y descripción iguales a contexto-ia/maquetado/index.html.
export const metadata: Metadata = {
  title: "Callejeros Río Cuarto — Hogar y Esperanza para Animales Rescatados",
  description:
    "Plataforma de bienestar animal en Río Cuarto. Adoptá, publicá casos de rescate, reportá mascotas perdidas y colaborá con refugios.",
};

export default function Home() {
  return (
    <main className="grow">
      <HeroCarousel />
      <AboutSection />
      <CollaborateSection />
    </main>
  );
}

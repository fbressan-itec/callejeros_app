import type { Metadata } from "next";

import { AdoptionCatalog } from "@/components/pets/AdoptionCatalog";

export const metadata: Metadata = {
  title: "Adoptá un Callejero — Callejeros Río Cuarto",
  description:
    "Encontrá perros y gatos rescatados listos para adopción responsable en Río Cuarto. Filtrá por especie, edad y sociabilidad.",
};

export default function AdopcionesPage() {
  return <AdoptionCatalog />;
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { PetDetailView } from "@/components/pets/PetDetailView";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export const metadata: Metadata = {
  title: "Ficha de Mascota — Callejeros Río Cuarto",
  description:
    "Conocé su historia, su salud y cómo adoptarlo o apadrinarlo en Callejeros Río Cuarto.",
};

async function PetDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PetDetailView rawId={id} />;
}

export default function PetDetailPage({ params }: PageProps<"/mascotas/[id]">) {
  return (
    <Suspense fallback={<LoadingScreen message="Cargando ficha..." />}>
      <PetDetailRoute params={params} />
    </Suspense>
  );
}

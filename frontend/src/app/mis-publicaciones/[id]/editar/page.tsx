import type { Metadata } from "next";
import { Suspense } from "react";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { EditPetView } from "@/components/pets/EditPetView";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export const metadata: Metadata = {
  title: "Editar publicación — Callejeros Río Cuarto",
  description:
    "Editá los datos y gestioná las fotos de tu publicación de mascota en Callejeros Río Cuarto.",
};

async function EditPetRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditPetView rawId={id} />;
}

export default function EditPetPage({
  params,
}: PageProps<"/mis-publicaciones/[id]/editar">) {
  return (
    <Suspense fallback={<LoadingScreen message="Cargando publicación..." />}>
      <RequireAuth
        fallback={<LoadingScreen message="Cargando publicación..." />}
      >
        <EditPetRoute params={params} />
      </RequireAuth>
    </Suspense>
  );
}

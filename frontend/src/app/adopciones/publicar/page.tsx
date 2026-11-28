import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { PublishPetView } from "@/components/pets/PublishPetView";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export const metadata: Metadata = {
  title: "Publicar Mascota — Callejeros Río Cuarto",
  description:
    "Publicá una mascota rescatada para adopción responsable en Río Cuarto.",
};

export default function PublishPetPage() {
  return (
    <RequireAuth fallback={<LoadingScreen message="Verificando sesión..." />}>
      <PublishPetView />
    </RequireAuth>
  );
}

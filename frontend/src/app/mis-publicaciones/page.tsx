import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { MyPetsView } from "@/components/pets/MyPetsView";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export const metadata: Metadata = {
  title: "Mis publicaciones — Callejeros Río Cuarto",
  description:
    "Administrá tus publicaciones de mascotas en adopción en Callejeros Río Cuarto.",
};

export default function MyPetsPage() {
  return (
    <RequireAuth
      fallback={<LoadingScreen message="Cargando tus publicaciones..." />}
    >
      <MyPetsView />
    </RequireAuth>
  );
}

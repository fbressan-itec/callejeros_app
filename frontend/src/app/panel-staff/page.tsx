import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { StaffPanel } from "@/components/staff/StaffPanel";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export const metadata: Metadata = {
  title: "Panel de Staff — Callejeros Río Cuarto",
  description:
    "Revisión de solicitudes de adopción y publicaciones de Callejeros Río Cuarto.",
};

const STAFF_ROLES = ["staff", "admin"] as const;

export default function StaffPanelPage() {
  return (
    <RequireAuth
      allowedRoles={STAFF_ROLES}
      fallback={<LoadingScreen message="Cargando panel..." />}
    >
      <StaffPanel />
    </RequireAuth>
  );
}

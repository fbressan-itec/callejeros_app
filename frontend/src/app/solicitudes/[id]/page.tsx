import type { Metadata } from "next";
import { Suspense } from "react";

import { AdoptionRequestView } from "@/components/adoptions/AdoptionRequestView";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export const metadata: Metadata = {
  title: "Mi Solicitud de Adopción — Callejeros Río Cuarto",
  description:
    "Estado y resultado de tu solicitud de adopción en Callejeros Río Cuarto.",
};

const LOADING = <LoadingScreen message="Cargando solicitud..." />;

async function AdoptionRequestRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireAuth fallback={LOADING}>
      <AdoptionRequestView rawId={id} />
    </RequireAuth>
  );
}

export default function AdoptionRequestPage({
  params,
}: PageProps<"/solicitudes/[id]">) {
  return (
    <Suspense fallback={LOADING}>
      <AdoptionRequestRoute params={params} />
    </Suspense>
  );
}

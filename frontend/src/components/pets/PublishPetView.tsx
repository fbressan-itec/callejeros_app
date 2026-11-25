"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { BackButton } from "@/components/layout/BackButton";
import { PetForm } from "@/components/pets/PetForm";
import { createPet } from "@/lib/pets/api";
import { buildCreatePetFormData, type PetFormValues } from "@/lib/pets/form";
import type { PetDetail } from "@/lib/pets/types";

export function PublishPetView() {
  const { user } = useAuth();
  const [createdPet, setCreatedPet] = useState<PetDetail | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function handleSubmitPet(
    values: PetFormValues,
    photos: readonly File[],
  ): Promise<void> {
    const formData = buildCreatePetFormData(values, photos);
    const created = await createPet(formData);
    setCreatedPet(created);
  }

  function handlePublishAnother() {
    setCreatedPet(null);
    setFormKey((prev) => prev + 1);
  }

  if (createdPet) {
    const isPublishedDirectly = createdPet.status === "published";

    return (
      <main className="mx-auto w-full max-w-lg grow px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        <div className="mb-4">
          <BackButton fallbackHref="/adopciones" />
        </div>

        <section
          aria-labelledby="publish-success-title"
          className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-soft sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-soft-dark"
        >
          <div
            aria-hidden="true"
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700 shadow-inner dark:bg-emerald-950/60 dark:text-emerald-400"
          >
            ✓
          </div>

          <div className="space-y-2">
            <h1
              id="publish-success-title"
              className="font-display text-2xl font-extrabold text-slate-900 dark:text-white"
            >
              {isPublishedDirectly
                ? "¡Publicación publicada!"
                : "¡Publicación enviada!"}
            </h1>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
              {isPublishedDirectly
                ? `La publicación de ${createdPet.name} ya está visible en el catálogo de adopción.`
                : `Un voluntario va a revisar la publicación de ${createdPet.name}. Cuando la apruebe, aparece en el catálogo y te avisamos en tus notificaciones.`}
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link
              href={`/mascotas/${createdPet.id}`}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-orange-700 px-4 py-3 font-display text-sm font-bold text-white shadow-md transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
            >
              Ver ficha de {createdPet.name}
            </Link>

            <Link
              href="/adopciones"
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
            >
              Ir al catálogo
            </Link>

            <button
              type="button"
              onClick={handlePublishAnother}
              className="min-h-[44px] px-3 text-xs font-bold text-orange-700 underline underline-offset-4 transition-colors hover:text-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:text-orange-400 dark:hover:text-orange-300 dark:focus-visible:ring-offset-slate-900"
            >
              Publicar otra mascota
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg grow px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <div className="mb-4">
        <BackButton fallbackHref="/adopciones" />
      </div>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-soft-dark">
        <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
          <span className="text-xs font-extrabold tracking-wider text-orange-700 uppercase dark:text-orange-400">
            Comunidad Callejeros R4
          </span>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            Publicar Mascota para Adopción
          </h1>
        </div>

        <PetForm
          key={formKey}
          defaultValues={{
            contactPhone: user?.phone ?? "",
          }}
          requirePhotos={true}
          submitLabel="Enviar para revisión"
          submittingLabel="Publicando..."
          onSubmitPet={handleSubmitPet}
        />
      </section>
    </main>
  );
}

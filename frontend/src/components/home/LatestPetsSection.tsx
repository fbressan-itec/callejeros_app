import Link from "next/link";

import { PetPreviewCard } from "@/components/pets/PetPreviewCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import type { LatestPetsState } from "@/lib/pets/useLatestPets";

/** Cuántas mascotas se piden para el inicio (en escritorio se ven 3 + "Explorar Catálogo"). */
export const HOME_PETS_LIMIT = 3;

const CATALOG_BUTTON_CLASSES =
  "inline-flex min-h-[44px] items-center rounded-xl bg-orange-700 px-5 text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900";

export interface LatestPetsSectionProps {
  state: LatestPetsState;
}

/**
 * "Adoptá un Callejero" del inicio (index.html): las mascotas publicadas más nuevas.
 * Celular y tablet: 2 tarjetas. Escritorio (≥1024px): 3 tarjetas + "Explorar Catálogo".
 */
export function LatestPetsSection({ state }: LatestPetsSectionProps) {
  return (
    <section className="mx-auto max-w-7xl border-b border-slate-200/80 px-4 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16 2xl:max-w-(--breakpoint-2xl) 2xl:px-20 dark:border-slate-800">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-extrabold tracking-wider text-orange-700 uppercase dark:text-orange-400">
            Adoptá un Callejero
          </span>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
            Encontrá a tu compañero ideal
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Cada uno de ellos tiene una historia de superación y está listo para
            llenar tu casa de alegría.
          </p>
        </div>
        <Link
          href="/adopciones"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-sm font-bold text-orange-700 hover:text-orange-800 hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:text-orange-400 dark:hover:text-orange-300 dark:focus-visible:ring-offset-slate-900"
        >
          <span>Ver catálogo completo</span>
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </Link>
      </div>

      <LatestPetsContent state={state} />
    </section>
  );
}

function LatestPetsContent({ state }: LatestPetsSectionProps) {
  if (state.status === "loading") {
    return <LoadingScreen variant="section" message="Cargando mascotas..." />;
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="flex min-h-40 items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        {state.message}
      </div>
    );
  }

  if (state.pets.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/50 p-6 text-center dark:border-orange-800/80 dark:bg-slate-850">
        <div
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10 text-2xl"
          aria-hidden="true"
        >
          🐾
        </div>
        <p className="font-display text-base font-bold text-slate-900 dark:text-white">
          Todavía no hay mascotas publicadas. ¡Volvé pronto!
        </p>
        <Link href="/adopciones" className={`mt-4 ${CATALOG_BUTTON_CLASSES}`}>
          Ver catálogo completo
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {state.pets.map((pet, index) => (
        // La tercera solo entra en escritorio (4 columnas).
        <div
          key={pet.id}
          data-testid="home-pet-item"
          className={index >= 2 ? "hidden lg:block" : ""}
        >
          <PetPreviewCard pet={pet} />
        </div>
      ))}

      {/* Tarjeta fija del maquetado: solo en escritorio. */}
      <div className="hidden flex-col items-center justify-center rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/50 p-6 text-center lg:flex dark:border-orange-800/80 dark:bg-slate-850">
        <div
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/10 text-2xl text-orange-600 dark:text-orange-400"
          aria-hidden="true"
        >
          🐾
        </div>
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
          Conocé a todos los rescatados
        </h3>
        <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
          Utilizá nuestros filtros avanzados para buscar por edad, especie y
          compatibilidad.
        </p>
        <Link href="/adopciones" className={`mt-4 ${CATALOG_BUTTON_CLASSES}`}>
          Explorar Catálogo
        </Link>
      </div>
    </div>
  );
}

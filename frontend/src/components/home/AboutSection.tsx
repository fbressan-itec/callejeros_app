import Image from "next/image";
import Link from "next/link";

/*
 * Sección "Sobre Nosotros" del inicio (textos iguales a contexto-ia/maquetado/index.html).
 *
 * "+150 Mascotas adoptadas" es un dato institucional fijo, a modo de publicidad:
 * no sale de la base (decisión de Franco en FR-05, #23). "Mascotas en adopción", en
 * cambio, es el total real de publicadas que devuelve `GET /api/pets/` (`count`).
 *
 * FOTO DE PRUEBA: /public/images/inicio/sobre-nosotros-perros-corriendo.jpg
 * (dos perros corriendo por un camino de tierra) se bajó de Unsplash solo para
 * desarrollo. Reemplazarla por una foto propia de Callejeros con el mismo nombre.
 */
export interface AboutSectionProps {
  /** Total de mascotas publicadas; `null` mientras carga o si falló el pedido. */
  publishedPetsCount: number | null;
}

export function AboutSection({ publishedPetsCount }: AboutSectionProps) {
  const stats = [
    {
      value: "+150",
      label: "Mascotas adoptadas",
      valueClass: "text-orange-600 dark:text-orange-500",
    },
    {
      // Mientras carga o si falla, se muestra una raya en lugar del número.
      value: publishedPetsCount === null ? "—" : String(publishedPetsCount),
      valueLabel: publishedPetsCount === null ? "Sin datos" : undefined,
      label: "Mascotas en adopción",
      valueClass: "text-blue-600 dark:text-blue-400",
    },
    {
      value: "100%",
      label: "Voluntariado local",
      valueClass: "text-emerald-600 dark:text-emerald-500",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl border-b border-slate-200/80 px-4 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16 2xl:max-w-(--breakpoint-2xl) 2xl:px-20 dark:border-slate-800">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
        {/* leading-6 en la etiqueta: iguala el alto de línea que tiene en el maquetado (Tailwind 3). */}
        <div className="flex flex-col gap-4">
          <span className="text-xs leading-6 font-extrabold tracking-wider text-blue-600 uppercase dark:text-blue-400">
            Sobre Nosotros
          </span>
          <h2 className="font-display text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
            Somos Callejeros Río IV
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base sm:leading-6 dark:text-slate-300">
            Una red colaborativa de voluntarios independientes, veterinarias
            solidarias y vecinos comprometidos con el rescate, rehabilitación y
            tenencia responsable en la ciudad de Río Cuarto.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2 sm:gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800"
              >
                <span
                  className={`block font-display text-xl font-extrabold ${stat.valueClass}`}
                >
                  {stat.valueLabel ? (
                    <>
                      <span aria-hidden="true">{stat.value}</span>
                      <span className="sr-only">{stat.valueLabel}</span>
                    </>
                  ) : (
                    stat.value
                  )}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Link
              href="/quienes-somos"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 sm:text-sm dark:focus-visible:ring-offset-slate-900"
            >
              <span>Conocé nuestra iniciativa</span>
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
        </div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-200 shadow-xl md:aspect-square dark:bg-slate-800">
          <Image
            src="/images/inicio/sobre-nosotros-perros-corriendo.jpg"
            alt="Dos perros corriendo felices por un camino de tierra"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}

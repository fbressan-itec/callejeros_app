import Image from "next/image";
import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/adopciones", label: "Adoptar un Callejero" },
  { href: "/alertas", label: "Alerta y Reportes" },
  { href: "/quienes-somos", label: "Quiénes Somos" },
  { href: "/donaciones", label: "Donaciones y Ayuda" },
] as const;

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <Image
                src="/images/logo_callejeros.jpg"
                alt="Logo Callejeros"
                width={116}
                height={40}
                className="h-10 w-auto rounded-md object-contain"
              />
              <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Callejeros Río Cuarto
              </span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
              Plataforma comunitaria independiente para la protección, rescate y
              adopción de animales en Río Cuarto, Córdoba.
            </p>
          </div>

          <div>
            <h4 className="mb-3 font-display text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-white">
              Navegación
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {FOOTER_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex items-center rounded-sm transition-colors hover:text-orange-500 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-950"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-display text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-white">
              Comunidad y Contacto
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Río Cuarto, Córdoba, Argentina
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              contacto@callejeros-r4.org
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-6 text-xs text-slate-600 sm:flex-row dark:border-slate-800 dark:text-slate-300">
          <p>© 2026 Callejeros Río Cuarto. Todos los derechos reservados.</p>
          <p className="text-slate-600 dark:text-slate-300">
            Desarrollado con amor por la comunidad animalista.
          </p>
        </div>
      </div>
    </footer>
  );
}

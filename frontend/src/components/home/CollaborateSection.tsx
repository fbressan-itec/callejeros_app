import Link from "next/link";

interface CollaborateOption {
  emoji: string;
  title: string;
  text: string;
  href: string;
  cta: string;
  iconBoxClass: string;
  buttonClass: string;
}

// Vías para colaborar (textos iguales a contexto-ia/maquetado/index.html).
const COLLABORATE_OPTIONS: CollaborateOption[] = [
  {
    emoji: "💳",
    title: "Donación Monetaria",
    text: "Transferí directamente a la cuenta comunitaria para costear tratamientos veterinarios e insumos médicos.",
    href: "/donaciones",
    cta: "Ver Datos de Transferencia",
    iconBoxClass: "bg-rose-50 text-rose-600 dark:bg-rose-950/40",
    buttonClass: "bg-rose-600 hover:bg-rose-700",
  },
  {
    emoji: "🤝",
    title: "Apadrinamiento",
    text: "Cubrí la bolsa de alimento o la medicación mensual de un animalito mientras espera su adopción definitiva.",
    href: "/donaciones#apadrinar",
    cta: "Quiero ser Padrino",
    iconBoxClass: "bg-orange-50 text-orange-600 dark:bg-orange-950/40",
    buttonClass: "bg-orange-700 hover:bg-orange-800",
  },
  {
    emoji: "🛍️",
    title: "Tienda Benéfica",
    text: "Adquirí remeras, chapitas identificatorias y accesorios. El 100% de lo recaudado financia los rescates.",
    href: "/tienda",
    cta: "Ir a la Tienda",
    iconBoxClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
    buttonClass: "bg-emerald-700 hover:bg-emerald-800",
  },
];

export function CollaborateSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16 2xl:max-w-(--breakpoint-2xl) 2xl:px-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <span className="text-xs font-extrabold tracking-wider text-rose-600 uppercase dark:text-rose-400">
          Unite a la Causa
        </span>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
          ¿Cómo podés colaborar hoy?
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          No todos pueden adoptar, pero todos pueden ayudar. Tu aporte hace la
          diferencia para comprar alimento, pagar cirugías y mantener los
          tránsitos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {COLLABORATE_OPTIONS.map((option) => (
          <div
            key={option.title}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-800 dark:shadow-soft-dark"
          >
            <div>
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${option.iconBoxClass}`}
                aria-hidden="true"
              >
                {option.emoji}
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {option.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm sm:leading-5 dark:text-slate-300">
                {option.text}
              </p>
            </div>
            <Link
              href={option.href}
              className={`mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl text-center text-xs font-bold text-white shadow-xs transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900 ${option.buttonClass}`}
            >
              {option.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

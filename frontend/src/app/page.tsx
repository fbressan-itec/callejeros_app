// Inicio provisorio: solo comprueba que el tema funciona. El inicio real llega en FR-05.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-5xl dark:text-slate-100">
        Callejeros Río Cuarto
      </h1>
      <p className="text-base text-slate-600 dark:text-slate-400">
        Adopción responsable y alertas de animales en la calle.
      </p>
      <span className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-orange-700 shadow-soft dark:bg-slate-800 dark:text-orange-400 dark:shadow-soft-dark">
        Sitio en construcción
      </span>
    </main>
  );
}

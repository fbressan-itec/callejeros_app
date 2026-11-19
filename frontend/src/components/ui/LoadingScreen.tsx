export interface LoadingScreenProps {
  message?: string;
  variant?: "page" | "section";
}

export function LoadingScreen({
  message = "Cargando...",
  variant = "page",
}: LoadingScreenProps) {
  const containerClasses =
    variant === "section"
      ? "flex min-h-40 flex-col items-center justify-center gap-3"
      : "flex min-h-[60vh] grow flex-col items-center justify-center gap-3";

  return (
    <div role="status" aria-live="polite" className={containerClasses}>
      <div
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500 motion-reduce:animate-none dark:border-slate-700 dark:border-t-orange-400"
      />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
        {message}
      </p>
    </div>
  );
}

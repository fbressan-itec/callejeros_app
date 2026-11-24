import type { UserRoleCode } from "@/components/layout/MobileMenu";

const BASE_CLASSES =
  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold";

/**
 * Insignia de rol de una cuenta, igual a las de `mi-cuenta.html`. El Admin no tiene insignia
 * en el maquetado: usa la violeta de Staff con su nombre.
 */
export function RoleBadge({ role }: { role: UserRoleCode }) {
  if (role === "staff" || role === "admin") {
    return (
      <span
        className={`${BASE_CLASSES} gap-1 bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300`}
      >
        <span aria-hidden="true">🛡️</span>
        {role === "admin" ? "Admin" : "Staff Callejeros"}
      </span>
    );
  }

  if (role === "verified_shelter") {
    return (
      <span
        className={`${BASE_CLASSES} gap-1.5 bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300`}
      >
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white"
          aria-hidden="true"
        >
          <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        Refugio verificado
      </span>
    );
  }

  return (
    <span
      className={`${BASE_CLASSES} bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300`}
    >
      🐾 Miembro de la comunidad
    </span>
  );
}

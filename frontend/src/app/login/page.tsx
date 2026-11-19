"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth/AuthProvider";
import { BackButton } from "@/components/layout/BackButton";
import { ApiError } from "@/lib/api/client";
import {
  getSafeRedirect,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from "@/lib/auth/session";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "El correo electrónico es obligatorio.")
    .email("Ingresá un correo electrónico válido."),
  password: z
    .string()
    .min(1, "La contraseña es obligatoria.")
    .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const rawRedirect = searchParams?.get("redirect") ?? null;
  const safeRedirect = getSafeRedirect(rawRedirect);
  const registerHref =
    safeRedirect !== "/"
      ? `/registro?redirect=${encodeURIComponent(safeRedirect)}`
      : "/registro";

  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [serverPasswordErrors, setServerPasswordErrors] = useState<string[]>(
    [],
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setGeneralError(null);
    setServerPasswordErrors([]);

    try {
      await login({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      });
      router.push(safeRedirect);
    } catch (error) {
      if (error instanceof ApiError) {
        const emailErrors = error.fieldErrors.email;
        const passwordErrors = error.fieldErrors.password;

        if (emailErrors?.length) {
          setError("email", { type: "server", message: emailErrors[0] });
        }
        if (passwordErrors?.length) {
          setServerPasswordErrors(passwordErrors);
          setError("password", {
            type: "server",
            message: passwordErrors[0],
          });
        }
        if (!emailErrors?.length && !passwordErrors?.length) {
          setGeneralError(error.message);
        }
        return;
      }
      setGeneralError("Algo salió mal. Intentá de nuevo.");
    }
  }

  const passwordErrorMessages =
    serverPasswordErrors.length > 0
      ? serverPasswordErrors
      : errors.password?.message
        ? [errors.password.message]
        : [];

  return (
    <main className="flex grow items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 dark:border-slate-700 dark:bg-slate-800 dark:shadow-soft-dark">
        {/* Botón Volver (estilo Figma "<") */}
        <BackButton fallbackHref={safeRedirect} />

        <div className="space-y-2 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-3xl text-orange-600 shadow-inner dark:bg-orange-950/60 dark:text-orange-400"
            aria-hidden="true"
          >
            👤
          </div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            Iniciar Sesión
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ingresá tu correo para acceder a tu perfil y reportes
          </p>
        </div>

        <form
          id="form-login"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          {generalError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {generalError}
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Correo Electrónico
            </label>
            <input
              type="email"
              id="login-email"
              autoComplete="email"
              placeholder="tu@correo.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              {...register("email")}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
            />
            {errors.email?.message && (
              <p
                id="login-email-error"
                role="alert"
                className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
              >
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="login-password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={passwordErrorMessages.length > 0}
                aria-describedby={
                  passwordErrorMessages.length > 0
                    ? "login-password-error"
                    : undefined
                }
                {...register("password")}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="toggle-password-btn absolute top-1/2 right-0 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:text-slate-200"
                aria-label="Mostrar u ocultar contraseña"
                aria-pressed={showPassword}
              >
                👁️
              </button>
            </div>
            {passwordErrorMessages.length > 0 && (
              <div
                id="login-password-error"
                role="alert"
                className="mt-1 space-y-0.5 text-xs font-semibold text-red-600 dark:text-red-400"
              >
                {passwordErrorMessages.map((msg) => (
                  <p key={msg}>{msg}</p>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                id="login-remember"
                {...register("rememberMe")}
                className="h-4 w-4 rounded-sm text-orange-500 focus:ring-2 focus:ring-orange-500"
              />
              <span>Recordarme</span>
            </label>
            <Link
              href="/recuperar"
              className="inline-flex min-h-[44px] items-center rounded-sm px-1 text-orange-600 hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-orange-400"
            >
              ¿Olvidaste tu clave?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] w-full rounded-xl bg-orange-700 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-800"
          >
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {/* Botones de ingreso social (Google / Facebook): quedan solo maquetados sin funcionalidad en esta etapa (alcance.md / 03-reglas-de-negocio.md). La aclaración va solo en este comentario de código y no en la interfaz web. */}
        <div className="space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-700/60">
          <p className="text-center text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            O ingresá con
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="btn-social-mock inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-800"
            >
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" />
              </svg>
              <span>Google</span>
            </button>
            <button
              type="button"
              className="btn-social-mock inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-800"
            >
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
              <span>Facebook</span>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 text-center text-xs text-slate-600 dark:border-slate-700/60 dark:text-slate-400">
          <span>¿No tenés una cuenta todavía?</span>
          <Link
            href={registerHref}
            className="ml-1 rounded-sm font-bold text-orange-600 hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-orange-400"
          >
            Registrate acá
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { BackButton } from "@/components/layout/BackButton";
import { ApiError } from "@/lib/api/client";
import {
  getMockVerificationCode,
  getSafeRedirect,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
  registerAccount,
} from "@/lib/auth/session";

const OTP_DURATION_SECONDS = 270; // 04:30 según registro.html

export const registerStep1Schema = z.object({
  fullName: z.string().trim().min(1, "El nombre es obligatorio."),
  email: z
    .string()
    .trim()
    .min(1, "El correo electrónico es obligatorio.")
    .email("Ingresá un correo electrónico válido."),
  password: z
    .string()
    .min(1, "La contraseña es obligatoria.")
    .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message:
      "Debés aceptar los términos de tenencia responsable y política de privacidad.",
  }),
});

export type RegisterStep1Values = z.infer<typeof registerStep1Schema>;

export const registerPhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "El número de teléfono es obligatorio.")
    .refine((val) => val.replace(/\D/g, "").length >= 7, {
      message: "Ingresá un número de teléfono válido.",
    }),
});

export type RegisterPhoneValues = z.infer<typeof registerPhoneSchema>;

type RegisterStep = "register" | "phone" | "verify" | "success";

function maskPhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length > 6) {
    return `${trimmed.slice(0, 4)} •••• ${trimmed.slice(-3)}`;
  }
  return trimmed;
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const mins = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `(${mins}:${secs})`;
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawRedirect = searchParams?.get("redirect") ?? null;
  const safeRedirect = getSafeRedirect(rawRedirect);
  const loginHref =
    safeRedirect !== "/"
      ? `/login?redirect=${encodeURIComponent(safeRedirect)}`
      : "/login";

  const [step, setStep] = useState<RegisterStep>("register");
  const [step1Data, setStep1Data] = useState<RegisterStep1Values | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [serverPasswordErrors, setServerPasswordErrors] = useState<string[]>(
    [],
  );
  const [isSubmittingApi, setIsSubmittingApi] = useState(false);

  // Paso 3: OTP y temporizador
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] =
    useState<number>(OTP_DURATION_SECONDS);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([
    null,
    null,
    null,
    null,
  ]);

  const {
    register: registerStep1,
    handleSubmit: handleSubmitStep1,
    setError: setStep1Error,
    formState: { errors: step1Errors },
  } = useForm<RegisterStep1Values>({
    resolver: zodResolver(registerStep1Schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      acceptTerms: false,
    },
  });

  const {
    register: registerPhone,
    handleSubmit: handleSubmitPhone,
    formState: { errors: phoneErrors },
  } = useForm<RegisterPhoneValues>({
    resolver: zodResolver(registerPhoneSchema),
    defaultValues: {
      phone: "",
    },
  });

  useEffect(() => {
    if (step !== "verify") return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [step]);

  useEffect(() => {
    if (step === "verify") {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

  async function submitRegistration({
    phone,
    verificationCode,
  }: {
    phone: string;
    verificationCode: string;
  }) {
    if (!step1Data) return;
    setGeneralError(null);
    setOtpError(null);
    setResendMessage(null);
    setServerPasswordErrors([]);
    setIsSubmittingApi(true);

    try {
      await registerAccount({
        fullName: step1Data.fullName,
        email: step1Data.email,
        password: step1Data.password,
        phone,
        verificationCode,
      });

      if (verificationCode) {
        setStep("success");
        window.setTimeout(() => {
          router.push(safeRedirect);
        }, 1200);
      } else {
        router.push(safeRedirect);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const emailErrors = error.fieldErrors.email;
        const passwordErrors = error.fieldErrors.password;
        const firstNameErrors = error.fieldErrors.first_name;
        const codeErrors = error.fieldErrors.verification_code;

        if (codeErrors?.length && step === "verify") {
          setOtpDigits(["", "", "", ""]);
          setOtpError(codeErrors[0]);
          otpRefs.current[0]?.focus();
          return;
        }

        if (
          emailErrors?.length ||
          passwordErrors?.length ||
          firstNameErrors?.length
        ) {
          setStep("register");
          if (firstNameErrors?.length) {
            setStep1Error("fullName", {
              type: "server",
              message: firstNameErrors[0],
            });
          }
          if (emailErrors?.length) {
            setStep1Error("email", {
              type: "server",
              message: emailErrors[0],
            });
          }
          if (passwordErrors?.length) {
            setServerPasswordErrors(passwordErrors);
            setStep1Error("password", {
              type: "server",
              message: passwordErrors[0],
            });
          }
          return;
        }

        if (step === "verify") {
          setOtpError(error.message);
        } else {
          setGeneralError(error.message);
        }
        return;
      }

      if (step === "verify") {
        setOtpError("Algo salió mal. Intentá de nuevo.");
      } else {
        setGeneralError("Algo salió mal. Intentá de nuevo.");
      }
    } finally {
      setIsSubmittingApi(false);
    }
  }

  function onStep1Submit(values: RegisterStep1Values) {
    setGeneralError(null);
    setServerPasswordErrors([]);
    setStep1Data(values);
    setStep("phone");
  }

  function onStep2Submit(values: RegisterPhoneValues) {
    setGeneralError(null);
    setPhoneNumber(values.phone.trim());
    setOtpDigits(["", "", "", ""]);
    setOtpError(null);
    setResendMessage(null);
    setRemainingSeconds(OTP_DURATION_SECONDS);
    setStep("verify");
  }

  async function handleSkipPhone() {
    await submitRegistration({ phone: "", verificationCode: "" });
  }

  function handleOtpChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    setOtpError(null);
    setResendMessage(null);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (!digits) return;

    setOtpError(null);
    setResendMessage(null);
    const next = ["", "", "", ""];
    for (let i = 0; i < 4; i++) {
      next[i] = digits[i] ?? "";
    }
    setOtpDigits(next);
    const focusIndex = Math.min(digits.length, 4) - 1;
    otpRefs.current[focusIndex]?.focus();
  }

  function handleResendCode() {
    setOtpDigits(["", "", "", ""]);
    setOtpError(null);
    setRemainingSeconds(OTP_DURATION_SECONDS);
    setResendMessage(
      `Código SMS reenviado a tu teléfono: ${getMockVerificationCode()}`,
    );
    otpRefs.current[0]?.focus();
  }

  async function handleVerifyOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendMessage(null);

    const enteredCode = otpDigits.join("");
    if (enteredCode.length < 4) {
      setOtpError("Ingresá los 4 dígitos del código de verificación.");
      return;
    }

    if (remainingSeconds <= 0) {
      setOtpError(
        'El código expiró. Tocá "Reenviar código" para recibir uno nuevo.',
      );
      return;
    }

    await submitRegistration({
      phone: phoneNumber,
      verificationCode: enteredCode,
    });
  }

  const passwordErrorMessages =
    serverPasswordErrors.length > 0
      ? serverPasswordErrors
      : step1Errors.password?.message
        ? [step1Errors.password.message]
        : [];

  return (
    <main className="my-4 flex grow items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft transition-all duration-300 sm:p-8 dark:border-slate-700 dark:bg-slate-800 dark:shadow-soft-dark">
        {generalError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {generalError}
          </div>
        )}

        {/* =================================================================== */}
        {/* PASO 1: FORMULARIO PRINCIPAL "REGISTRATE"                           */}
        {/* =================================================================== */}
        {step === "register" && (
          <div id="step-register" className="space-y-6">
            <BackButton fallbackHref={safeRedirect} />

            <div className="space-y-2 text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 shadow-inner dark:bg-emerald-950/60 dark:text-emerald-400"
                aria-hidden="true"
              >
                ✨
              </div>
              <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Registrate
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sumate a la red comunitaria de protección animal
              </p>
            </div>

            <form
              id="form-register"
              noValidate
              onSubmit={handleSubmitStep1(onStep1Submit)}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="reg-name"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Nombre Completo
                </label>
                <div className="relative">
                  <span
                    className="absolute top-3.5 left-3.5 text-slate-400"
                    aria-hidden="true"
                  >
                    👤
                  </span>
                  <input
                    type="text"
                    id="reg-name"
                    autoComplete="name"
                    placeholder="Juan Pérez"
                    aria-invalid={Boolean(step1Errors.fullName)}
                    aria-describedby={
                      step1Errors.fullName ? "reg-name-error" : undefined
                    }
                    {...registerStep1("fullName")}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pr-4 pl-10 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
                  />
                </div>
                {step1Errors.fullName?.message && (
                  <p
                    id="reg-name-error"
                    role="alert"
                    className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {step1Errors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span
                    className="absolute top-3.5 left-3.5 text-slate-400"
                    aria-hidden="true"
                  >
                    ✉️
                  </span>
                  <input
                    type="email"
                    id="reg-email"
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    aria-invalid={Boolean(step1Errors.email)}
                    aria-describedby={
                      step1Errors.email ? "reg-email-error" : undefined
                    }
                    {...registerStep1("email")}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pr-4 pl-10 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
                  />
                </div>
                {step1Errors.email?.message && (
                  <p
                    id="reg-email-error"
                    role="alert"
                    className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {step1Errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <span
                    className="absolute top-3.5 left-3.5 text-slate-400"
                    aria-hidden="true"
                  >
                    🔒
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="reg-password"
                    autoComplete="new-password"
                    placeholder="••••••••••"
                    aria-invalid={passwordErrorMessages.length > 0}
                    aria-describedby={
                      passwordErrorMessages.length > 0
                        ? "reg-password-error"
                        : undefined
                    }
                    {...registerStep1("password")}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pr-12 pl-10 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
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
                    id="reg-password-error"
                    role="alert"
                    className="mt-1 space-y-0.5 text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {passwordErrorMessages.map((msg) => (
                      <p key={msg}>{msg}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-1">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    id="reg-terms"
                    {...registerStep1("acceptTerms")}
                    className="mt-0.5 h-4 w-4 rounded-sm text-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  <span>
                    Acepto los términos de tenencia responsable y política de
                    privacidad de la red comunitaria.
                  </span>
                </label>
                {step1Errors.acceptTerms?.message && (
                  <p
                    id="reg-terms-error"
                    role="alert"
                    className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {step1Errors.acceptTerms.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingApi}
                className="min-h-[44px] w-full rounded-xl bg-slate-950 py-3.5 font-display text-sm font-bold tracking-wider text-white shadow-md transition-all hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-700 dark:hover:bg-orange-800 dark:focus-visible:ring-offset-slate-800"
              >
                {isSubmittingApi ? "Registrando..." : "Registrarme"}
              </button>
            </form>

            {/* Botones de registro social (Google / Facebook): quedan solo maquetados sin funcionalidad en esta etapa (alcance.md / 03-reglas-de-negocio.md). La aclaración va solo en este comentario de código y no en la interfaz web. */}
            <div className="space-y-3 border-t border-slate-100 pt-2 dark:border-slate-700/60">
              <p className="text-center text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Registrate con ...
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="btn-social-mock inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 uppercase transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-800"
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
                  className="btn-social-mock inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 uppercase transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-800"
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

            <div className="pt-2 text-center text-xs text-slate-600 dark:text-slate-400">
              <span>¿Ya tenés cuenta?</span>
              <Link
                href={loginHref}
                className="ml-1 rounded-sm font-bold text-orange-600 hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-orange-400"
              >
                Iniciá sesión
              </Link>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* PASO 2: INGRESÁ TU NÚMERO DE TELÉFONO                               */}
        {/* =================================================================== */}
        {step === "phone" && (
          <div id="step-phone" className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <button
                type="button"
                id="btn-back-to-step1"
                onClick={() => setStep("register")}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Volver al formulario de registro"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-xs font-extrabold tracking-wider text-orange-600 uppercase dark:text-orange-400">
                Paso 2 de 3
              </span>
              <div className="w-11" />
            </div>

            <div className="space-y-2 text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl text-blue-600 shadow-inner dark:bg-blue-950/60 dark:text-blue-400"
                aria-hidden="true"
              >
                📱
              </div>
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Ingresá tu número de teléfono
              </h2>
              <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Te enviaremos un código de seguridad para verificar tu cuenta y
                garantizar la seguridad de las adopciones comunitarias.
              </p>
            </div>

            <form
              id="form-phone"
              noValidate
              onSubmit={handleSubmitPhone(onStep2Submit)}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="reg-phone"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Número de Teléfono
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute left-3.5 text-slate-400"
                    aria-hidden="true"
                  >
                    📞
                  </span>
                  <input
                    type="tel"
                    id="reg-phone"
                    autoComplete="tel"
                    placeholder="358 4123456"
                    aria-invalid={Boolean(phoneErrors.phone)}
                    aria-describedby={
                      phoneErrors.phone ? "reg-phone-error" : "reg-phone-help"
                    }
                    {...registerPhone("phone")}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pr-4 pl-10 text-base font-medium text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
                  />
                </div>
                <p
                  id="reg-phone-help"
                  className="mt-1 pl-1 text-[11px] text-slate-500 dark:text-slate-400"
                >
                  Ejemplo: 358 4123456 o +54 9 358 4123456
                </p>
                {phoneErrors.phone?.message && (
                  <p
                    id="reg-phone-error"
                    role="alert"
                    className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {phoneErrors.phone.message}
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingApi}
                  className="min-h-[44px] w-full rounded-xl bg-slate-950 py-3.5 font-display text-sm font-bold tracking-wider text-white shadow-md transition-all hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-700 dark:hover:bg-orange-800 dark:focus-visible:ring-offset-slate-800"
                >
                  Verificar
                </button>
                <button
                  type="button"
                  id="btn-skip-phone"
                  disabled={isSubmittingApi}
                  onClick={() => void handleSkipPhone()}
                  className="min-h-[44px] w-full rounded-xl bg-slate-100 py-3 font-display text-xs font-bold tracking-wider text-slate-700 uppercase transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:focus-visible:ring-offset-slate-800"
                >
                  {isSubmittingApi ? "Registrando..." : "Más tarde"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* PASO 3: VALIDACIÓN POR CÓDIGO SMS (MAQUETADA)                       */}
        {/* =================================================================== */}
        {step === "verify" && (
          <div id="step-verify-code" className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <button
                type="button"
                id="btn-back-to-step2"
                onClick={() => setStep("phone")}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Cambiar número de teléfono"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-xs font-extrabold tracking-wider text-orange-600 uppercase dark:text-orange-400">
                Paso 3 de 3
              </span>
              <div className="w-11" />
            </div>

            <div className="space-y-2 text-center">
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Verificá tu teléfono
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Te enviamos un código de 4 dígitos a
              </p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                <span id="display-phone-masked">
                  {maskPhoneNumber(phoneNumber)}
                </span>
              </div>
            </div>

            <form
              id="form-verify-code"
              noValidate
              onSubmit={(event) => void handleVerifyOtpSubmit(event)}
              className="space-y-5"
            >
              <div className="space-y-2.5">
                <div
                  role="group"
                  aria-label="Código de verificación por SMS"
                  className="flex items-center justify-center gap-2.5 sm:gap-3"
                >
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="text"
                      id={`otp-${index + 1}`}
                      maxLength={1}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Dígito ${index + 1}`}
                      value={digit}
                      onChange={(event) =>
                        handleOtpChange(index, event.target.value)
                      }
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      onPaste={handleOtpPaste}
                      className="otp-input h-14 w-12 rounded-2xl border-2 border-slate-300 bg-slate-50 text-center font-mono text-2xl font-extrabold text-slate-900 shadow-xs transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden sm:h-16 sm:w-14 dark:border-slate-700 dark:bg-slate-850 dark:text-white"
                    />
                  ))}
                </div>

                {/* Mensaje obligatorio en rojo con asterisco debajo del campo del código (alcance.md y 03-reglas-de-negocio.md) */}
                <p
                  id="mock-sms-code-notice"
                  className="text-center text-xs font-semibold text-red-600 dark:text-red-400"
                >
                  * Verificación por SMS maquetada: usá el código{" "}
                  <strong className="font-mono font-extrabold">
                    {getMockVerificationCode()}
                  </strong>
                  .
                </p>
              </div>

              <div className="space-y-1 text-center">
                <span
                  id="countdown-timer"
                  className="font-mono text-xs text-slate-500 dark:text-slate-400"
                >
                  {remainingSeconds > 0
                    ? `⏱️ ${formatCountdown(remainingSeconds)}`
                    : "⏱️ (00:00) Código expirado"}
                </span>
                {otpError && (
                  <p
                    id="verify-code-error"
                    role="alert"
                    className="text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {otpError}
                  </p>
                )}
                {resendMessage && (
                  <p
                    role="status"
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                  >
                    {resendMessage}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  id="btn-submit-otp"
                  disabled={isSubmittingApi}
                  className="min-h-[44px] w-full rounded-xl bg-slate-950 py-3.5 font-display text-sm font-bold tracking-wider text-white shadow-md transition-all hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-700 dark:hover:bg-orange-800 dark:focus-visible:ring-offset-slate-800"
                >
                  {isSubmittingApi ? "Verificando..." : "Verificar"}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    id="btn-resend-code"
                    onClick={handleResendCode}
                    className="min-h-[44px] rounded-xl px-3 text-xs font-bold text-orange-600 hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-orange-400"
                  >
                    Reenviar código
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* PASO 4: CONFIRMACIÓN DE ÉXITO                                       */}
        {/* =================================================================== */}
        {step === "success" && (
          <div id="step-success" className="space-y-4 py-4 text-center">
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600 shadow-inner dark:bg-emerald-950/60 dark:text-emerald-400"
              aria-hidden="true"
            >
              ✓
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                ¡Teléfono Verificado!
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm dark:text-slate-300">
                Tu cuenta ha sido creada y verificada exitosamente.
              </p>
              <p className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Redirigiendo a Callejeros Río Cuarto...
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

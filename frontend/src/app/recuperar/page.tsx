"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { BackButton } from "@/components/layout/BackButton";
import {
  getMockVerificationCode,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
} from "@/lib/auth/session";

const RECOVER_OTP_DURATION_SECONDS = 150; // 02:30 según recuperar.html

export const recoverMethodSchema = z
  .object({
    method: z.enum(["email", "phone"]),
    contact: z.string().trim().min(1, "Este campo es obligatorio."),
  })
  .superRefine((values, ctx) => {
    if (values.method === "email") {
      const emailCheck = z.string().email().safeParse(values.contact);
      if (!emailCheck.success) {
        ctx.addIssue({
          code: "custom",
          path: ["contact"],
          message: "Ingresá un correo electrónico válido.",
        });
      }
      return;
    }

    if (values.contact.replace(/\D/g, "").length < 7) {
      ctx.addIssue({
        code: "custom",
        path: ["contact"],
        message: "Ingresá un número de teléfono válido.",
      });
    }
  });

export type RecoverMethodValues = z.infer<typeof recoverMethodSchema>;

export const recoverPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, "La contraseña es obligatoria.")
      .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
    confirmPassword: z
      .string()
      .min(1, "Repetí la contraseña.")
      .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export type RecoverPasswordValues = z.infer<typeof recoverPasswordSchema>;

type RecoverStep = "method" | "code" | "password" | "success";

export function maskRecoverContact(value: string, isPhone: boolean): string {
  const trimmed = value.trim();
  if (isPhone) {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length > 3 ? `•••• •••• ${digits.slice(-3)}` : trimmed;
  }
  const [user, domain] = trimmed.split("@");
  if (!user || !domain) return trimmed;
  return `${user.slice(0, 2)}•••@${domain}`;
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const mins = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `(${mins}:${secs})`;
}

export default function RecoverPasswordPage() {
  const [step, setStep] = useState<RecoverStep>("method");
  const [selectedMethod, setSelectedMethod] = useState<"email" | "phone">(
    "email",
  );
  const [contactValue, setContactValue] = useState("");

  // Paso 2: código OTP y temporizador
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    RECOVER_OTP_DURATION_SECONDS,
  );
  const otpRefs = useRef<Array<HTMLInputElement | null>>([
    null,
    null,
    null,
    null,
  ]);

  // Paso 3: visibilidad de contraseñas
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  const {
    register: registerMethod,
    handleSubmit: handleSubmitMethod,
    setValue: setMethodValue,
    clearErrors: clearMethodErrors,
    formState: { errors: methodErrors },
  } = useForm<RecoverMethodValues>({
    resolver: zodResolver(recoverMethodSchema),
    defaultValues: {
      method: "email",
      contact: "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors, isSubmitting: isSubmittingPassword },
  } = useForm<RecoverPasswordValues>({
    resolver: zodResolver(recoverPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (step !== "code") return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [step]);

  useEffect(() => {
    if (step === "code") {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

  function handleMethodChange(nextMethod: "email" | "phone") {
    setSelectedMethod(nextMethod);
    setMethodValue("method", nextMethod);
    setMethodValue("contact", "");
    clearMethodErrors("contact");
  }

  function onStep1Submit(values: RecoverMethodValues) {
    setSelectedMethod(values.method);
    setContactValue(values.contact.trim());
    setOtpDigits(["", "", "", ""]);
    setCodeError(null);
    setResendMessage(null);
    setRemainingSeconds(RECOVER_OTP_DURATION_SECONDS);
    setStep("code");
  }

  function handleOtpChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(0, 1);
    setCodeError(null);
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

    setCodeError(null);
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
    setCodeError(null);
    setRemainingSeconds(RECOVER_OTP_DURATION_SECONDS);
    setResendMessage(`Código reenviado: ${getMockVerificationCode()}`);
    otpRefs.current[0]?.focus();
  }

  function handleVerifyCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendMessage(null);

    const code = otpDigits.join("");
    if (code.length < 4) {
      setCodeError("Ingresá los 4 dígitos del código.");
      return;
    }

    if (remainingSeconds <= 0) {
      setCodeError('El código expiró. Tocá "Reenviar código".');
      return;
    }

    const expectedCode = getMockVerificationCode();
    if (code !== expectedCode) {
      setCodeError(
        `Código incorrecto. Probá con el código de demostración ${expectedCode}.`,
      );
      return;
    }

    setCodeError(null);
    resetPasswordForm();
    setStep("password");
  }

  function onStep3Submit() {
    setStep("success");
  }

  const isPhone = selectedMethod === "phone";

  return (
    <main className="my-4 flex grow items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 dark:border-slate-700 dark:bg-slate-800 dark:shadow-soft-dark">
        {/* =================================================================== */}
        {/* PASO 1: ELEGIR MÉTODO (Email o Teléfono)                            */}
        {/* =================================================================== */}
        {step === "method" && (
          <div id="recover-step-method" className="space-y-6">
            <BackButton fallbackHref="/login" />

            <div className="space-y-2">
              <span className="text-xs font-extrabold tracking-wider text-orange-600 uppercase dark:text-orange-400">
                Paso 1 de 3
              </span>
              <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                ¿Olvidaste tu contraseña?
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Seleccioná el método para recuperar tu cuenta.
              </p>
            </div>

            <form
              id="form-recover-method"
              noValidate
              onSubmit={handleSubmitMethod(onStep1Submit)}
              className="space-y-5"
            >
              {/* Métodos (tarjetas seleccionables) */}
              <fieldset className="space-y-3">
                <legend className="sr-only">Método de recuperación</legend>
                <label className="flex min-h-[64px] cursor-pointer items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 transition-colors hover:border-orange-400 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 dark:border-slate-700 dark:bg-slate-850 dark:has-[:checked]:bg-orange-950/30">
                  <input
                    type="radio"
                    value="email"
                    checked={selectedMethod === "email"}
                    {...registerMethod("method", {
                      onChange: () => handleMethodChange("email"),
                    })}
                    className="sr-only"
                  />
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-xs dark:bg-slate-800"
                    aria-hidden="true"
                  >
                    ✉️
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">
                      Email
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Te enviamos un código a tu correo
                    </span>
                  </span>
                </label>

                <label className="flex min-h-[64px] cursor-pointer items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 transition-colors hover:border-orange-400 has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 dark:border-slate-700 dark:bg-slate-850 dark:has-[:checked]:bg-orange-950/30">
                  <input
                    type="radio"
                    value="phone"
                    checked={selectedMethod === "phone"}
                    {...registerMethod("method", {
                      onChange: () => handleMethodChange("phone"),
                    })}
                    className="sr-only"
                  />
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-xs dark:bg-slate-800"
                    aria-hidden="true"
                  >
                    📱
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">
                      Teléfono
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Te enviamos un código por SMS
                    </span>
                  </span>
                </label>
              </fieldset>

              {/* Dato de contacto (cambia según el método elegido) */}
              <div>
                <label
                  id="recover-contact-label"
                  htmlFor="recover-contact"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {isPhone ? "Número de teléfono" : "Correo electrónico"}
                </label>
                <input
                  type={isPhone ? "tel" : "email"}
                  id="recover-contact"
                  inputMode={isPhone ? "tel" : "email"}
                  autoComplete={isPhone ? "tel" : "email"}
                  placeholder={isPhone ? "358 4123456" : "tu@correo.com"}
                  aria-invalid={Boolean(methodErrors.contact)}
                  aria-describedby={
                    methodErrors.contact ? "recover-contact-error" : undefined
                  }
                  {...registerMethod("contact")}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
                />
                {methodErrors.contact?.message && (
                  <p
                    id="recover-contact-error"
                    role="alert"
                    className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {methodErrors.contact.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="min-h-[44px] w-full rounded-xl bg-slate-950 py-3.5 font-display text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-orange-700 dark:hover:bg-orange-800 dark:focus-visible:ring-offset-slate-800"
              >
                Siguiente
              </button>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* PASO 2: VERIFICAR CÓDIGO (MAQUETADO)                                */}
        {/* =================================================================== */}
        {step === "code" && (
          <div id="recover-step-code" className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                id="btn-recover-back-1"
                onClick={() => setStep("method")}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:focus-visible:ring-offset-slate-800"
                aria-label="Cambiar método de recuperación"
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
              <h2
                id="recover-code-title"
                className="font-display text-2xl font-extrabold text-slate-900 dark:text-white"
              >
                {isPhone ? "Verificá tu teléfono" : "Verificá tu email"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Te enviamos un código de 4 dígitos a
              </p>
              <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                <span id="recover-contact-masked">
                  {maskRecoverContact(contactValue, isPhone)}
                </span>
              </div>
            </div>

            <form
              id="form-recover-code"
              noValidate
              onSubmit={handleVerifyCodeSubmit}
              className="space-y-6"
            >
              <div className="space-y-2.5">
                <div
                  role="group"
                  aria-label="Código de verificación"
                  className="flex items-center justify-center gap-2.5 sm:gap-3"
                >
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="text"
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
                      className="recover-otp h-14 w-12 rounded-2xl border-2 border-slate-300 bg-slate-50 text-center font-mono text-2xl font-extrabold text-slate-900 shadow-xs transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-hidden sm:h-16 sm:w-14 dark:border-slate-700 dark:bg-slate-850 dark:text-white"
                    />
                  ))}
                </div>

                {/* Mensaje obligatorio en rojo con asterisco debajo del campo del código (alcance.md y 03-reglas-de-negocio.md) */}
                <p
                  id="mock-recover-code-notice"
                  className="text-center text-xs font-semibold text-red-600 dark:text-red-400"
                >
                  * Recuperación de contraseña maquetada: usá el código{" "}
                  <strong className="font-mono font-extrabold">
                    {getMockVerificationCode()}
                  </strong>
                  .
                </p>
              </div>

              {/* Temporizador (Figma: "(02:30)") y mensaje de error */}
              <div className="space-y-1 text-center">
                <span
                  id="recover-timer"
                  className="font-mono text-xs text-slate-500 dark:text-slate-400"
                >
                  {remainingSeconds > 0
                    ? `⏱️ ${formatCountdown(remainingSeconds)}`
                    : "⏱️ (00:00) Código expirado"}
                </span>
                {codeError && (
                  <p
                    id="recover-code-error"
                    role="alert"
                    className="text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {codeError}
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

              <div className="space-y-2">
                <button
                  type="submit"
                  className="min-h-[44px] w-full rounded-xl bg-slate-950 py-3.5 font-display text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-orange-700 dark:hover:bg-orange-800 dark:focus-visible:ring-offset-slate-800"
                >
                  Verificar
                </button>
                <button
                  type="button"
                  id="btn-recover-resend"
                  onClick={handleResendCode}
                  className="min-h-[44px] w-full rounded-xl text-sm font-bold text-orange-600 transition-colors hover:bg-orange-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-orange-400 dark:hover:bg-slate-700"
                >
                  Reenviar código
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* PASO 3: NUEVA CONTRASEÑA                                            */}
        {/* =================================================================== */}
        {step === "password" && (
          <div id="recover-step-password" className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                id="btn-recover-back-2"
                onClick={() => {
                  setRemainingSeconds(RECOVER_OTP_DURATION_SECONDS);
                  setStep("code");
                }}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:focus-visible:ring-offset-slate-800"
                aria-label="Volver al código"
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

            <div className="space-y-2">
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                Introducí tu nueva contraseña
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Usá al menos 6 caracteres.
              </p>
            </div>

            <form
              id="form-recover-password"
              noValidate
              onSubmit={handleSubmitPassword(onStep3Submit)}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="recover-pass-1"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass1 ? "text" : "password"}
                    id="recover-pass-1"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-invalid={Boolean(passwordErrors.password)}
                    aria-describedby={
                      passwordErrors.password
                        ? "recover-pass-1-error"
                        : undefined
                    }
                    {...registerPassword("password")}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass1((prev) => !prev)}
                    className="toggle-password-btn absolute top-1/2 right-0 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:text-slate-200"
                    aria-label="Mostrar u ocultar nueva contraseña"
                    aria-pressed={showPass1}
                  >
                    👁️
                  </button>
                </div>
                {passwordErrors.password?.message && (
                  <p
                    id="recover-pass-1-error"
                    role="alert"
                    className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {passwordErrors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="recover-pass-2"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Repetí la contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPass2 ? "text" : "password"}
                    id="recover-pass-2"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-invalid={Boolean(passwordErrors.confirmPassword)}
                    aria-describedby={
                      passwordErrors.confirmPassword
                        ? "recover-pass-error"
                        : undefined
                    }
                    {...registerPassword("confirmPassword")}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-850 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass2((prev) => !prev)}
                    className="toggle-password-btn absolute top-1/2 right-0 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:text-slate-200"
                    aria-label="Mostrar u ocultar repetición de contraseña"
                    aria-pressed={showPass2}
                  >
                    👁️
                  </button>
                </div>
                {passwordErrors.confirmPassword?.message && (
                  <p
                    id="recover-pass-error"
                    role="alert"
                    className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400"
                  >
                    {passwordErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingPassword}
                className="min-h-[44px] w-full rounded-xl bg-slate-950 py-3.5 font-display text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-700 dark:hover:bg-orange-800 dark:focus-visible:ring-offset-slate-800"
              >
                {isSubmittingPassword
                  ? "Restableciendo..."
                  : "Restablecer contraseña"}
              </button>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* ÉXITO                                                               */}
        {/* =================================================================== */}
        {step === "success" && (
          <div id="recover-step-success" className="space-y-4 py-6 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
              aria-hidden="true"
            >
              ✓
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                ¡Contraseña actualizada!
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ya podés iniciar sesión con tu nueva contraseña.
              </p>
            </div>
            <Link
              href="/login"
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-orange-700 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-800"
            >
              Iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

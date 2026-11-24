import type { ReactNode } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

import type { ChoiceOption } from "@/lib/adoptions/questionnaire";

/** Clases de los campos del cuestionario (iguales al formulario de `mascota.html`). */
const LABEL_CLASSES =
  "mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300";
const INPUT_CLASSES =
  "w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:aria-invalid:border-red-400";
const HELP_CLASSES = "mt-1 text-[11px] text-slate-500 dark:text-slate-400";
const ERROR_CLASSES =
  "mt-1 text-xs font-semibold text-red-600 dark:text-red-400";

function describedBy(...ids: (string | false | undefined)[]) {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

function FieldErrorMessage({ id, error }: { id: string; error?: FieldError }) {
  if (!error?.message) return null;
  return (
    <p id={id} role="alert" className={ERROR_CLASSES}>
      {error.message}
    </p>
  );
}

interface BaseFieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  help?: string;
  required?: boolean;
}

export function TextField({
  id,
  label,
  registration,
  error,
  help,
  required = true,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
}: BaseFieldProps & {
  type?: "text" | "email" | "tel";
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "email" | "tel";
}) {
  // Con error, el aviso reemplaza la ayuda (en la edad dicen lo mismo)
  const helpId = help && !error ? `${id}-help` : undefined;
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASSES}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(helpId, error && errorId)}
        className={INPUT_CLASSES}
        {...registration}
      />
      {helpId ? (
        <p id={helpId} className={HELP_CLASSES}>
          {help}
        </p>
      ) : null}
      <FieldErrorMessage id={errorId} error={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  registration,
  error,
  help,
  required = true,
  placeholder,
  rows = 2,
}: BaseFieldProps & { placeholder?: string; rows?: number }) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASSES}>
        {label}
        {required ? " *" : ""}
      </label>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(helpId, error && errorId)}
        className={`${INPUT_CLASSES} resize-y`}
        {...registration}
      />
      {help ? (
        <p id={helpId} className={HELP_CLASSES}>
          {help}
        </p>
      ) : null}
      <FieldErrorMessage id={errorId} error={error} />
    </div>
  );
}

export function RadioGroupField({
  id,
  label,
  registration,
  error,
  options,
}: BaseFieldProps & { options: readonly ChoiceOption<string>[] }) {
  const errorId = `${id}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className={LABEL_CLASSES}>{label} *</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm font-medium text-slate-700 transition-colors focus-within:ring-2 focus-within:ring-orange-500 has-checked:border-orange-600 has-checked:bg-orange-50 has-checked:text-orange-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:has-checked:border-orange-400 dark:has-checked:bg-orange-950/40 dark:has-checked:text-orange-200"
          >
            <input
              type="radio"
              value={option.value}
              className="h-4 w-4 accent-orange-600 focus:outline-hidden"
              {...registration}
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldErrorMessage id={errorId} error={error} />
    </fieldset>
  );
}

export function CheckboxField({
  id,
  registration,
  error,
  children,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  children: ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 rounded-sm accent-orange-600 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
          {...registration}
        />
        <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {children}
        </span>
      </label>
      <FieldErrorMessage id={errorId} error={error} />
    </div>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import {
  CheckboxField,
  RadioGroupField,
  TextAreaField,
  TextField,
} from "@/components/adoptions/QuestionnaireFields";
import { createAdoptionRequest } from "@/lib/adoptions/api";
import {
  type AdoptionQuestionnaireValues,
  buildQuestionnaireSchema,
  getFirstStepWithError,
  getQuestionnaireDefaultValues,
  HOME_OWNERSHIP_OPTIONS,
  HOURS_ALONE_OPTIONS,
  HOUSEHOLD_AGREEMENT_OPTIONS,
  QUESTIONNAIRE_STEP_COUNT,
  QUESTIONNAIRE_STEP_FIELDS,
  QUESTIONNAIRE_STEP_TITLES,
  type QuestionnaireStep,
  RENTAL_PETS_POLICY_OPTIONS,
  toAdoptionRequestPayload,
} from "@/lib/adoptions/questionnaire";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";

export interface AdoptionQuestionnaireModalProps {
  isOpen: boolean;
  pet: { id: number; name: string; is_neutered: boolean };
  /** Nombre y correo de la cuenta, para precargarlos (se pueden editar). */
  prefill: { fullName: string; email: string };
  onClose: () => void;
  onSubmitted: () => void;
}

const QUESTIONNAIRE_FIELD_NAMES = new Set<string>(
  Object.values(QUESTIONNAIRE_STEP_FIELDS).flat(),
);

const PRIMARY_BUTTON_CLASSES =
  "min-h-[44px] flex-1 rounded-xl bg-orange-700 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-slate-900";
const SECONDARY_BUTTON_CLASSES =
  "min-h-[44px] rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900";

export function AdoptionQuestionnaireModal({
  isOpen,
  pet,
  prefill,
  onClose,
  onSubmitted,
}: AdoptionQuestionnaireModalProps) {
  const requiresNeutering = !pet.is_neutered;
  const [step, setStep] = useState<QuestionnaireStep>(1);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stepRef = useRef<QuestionnaireStep>(1);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);

  // Se valida solo el paso actual; al enviar (paso 4), el cuestionario completo.
  const resolver: Resolver<AdoptionQuestionnaireValues> = (
    values,
    context,
    options,
  ) => {
    const current = stepRef.current;
    const schema = buildQuestionnaireSchema(
      requiresNeutering,
      current === QUESTIONNAIRE_STEP_COUNT ? "all" : current,
    );
    // Un paso valida solo sus campos: el tipo de salida es el del cuestionario completo
    const stepSchema = schema as z.ZodType<
      AdoptionQuestionnaireValues,
      AdoptionQuestionnaireValues
    >;
    return zodResolver(stepSchema)(values, context, options);
  };

  const {
    control,
    register,
    trigger,
    getValues,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<AdoptionQuestionnaireValues>({
    resolver,
    defaultValues: getQuestionnaireDefaultValues(),
  });

  const homeOwnership = useWatch({ control, name: "home_ownership" });

  function goToStep(next: QuestionnaireStep) {
    stepRef.current = next;
    setStep(next);
  }

  // Al abrir: precarga nombre y correo si están vacíos y lleva el foco al título del paso.
  useEffect(() => {
    if (!isOpen) return;
    if (!getValues("full_name") && prefill.fullName) {
      setValue("full_name", prefill.fullName);
    }
    if (!getValues("email") && prefill.email) {
      setValue("email", prefill.email);
    }
  }, [isOpen, prefill.fullName, prefill.email, getValues, setValue]);

  useEffect(() => {
    if (isOpen) stepHeadingRef.current?.focus();
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add("overflow-hidden");
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  async function handleNext() {
    const isValid = await trigger([...QUESTIONNAIRE_STEP_FIELDS[step]], {
      shouldFocus: true,
    });
    if (!isValid) return;
    setGeneralError(null);
    goToStep((step + 1) as QuestionnaireStep);
  }

  function handlePrevious() {
    setGeneralError(null);
    goToStep((step - 1) as QuestionnaireStep);
  }

  async function submitQuestionnaire() {
    const isValid = await trigger();
    if (!isValid) {
      // Por si se editó un paso anterior y quedó con error: se vuelve a ese paso
      const result =
        buildQuestionnaireSchema(requiresNeutering).safeParse(getValues());
      const failedStep = result.success
        ? null
        : getFirstStepWithError(
            result.error.issues.map((issue) => String(issue.path[0])),
          );
      if (failedStep && failedStep !== step) goToStep(failedStep);
      return;
    }

    setGeneralError(null);
    setIsSubmitting(true);
    try {
      await createAdoptionRequest(
        toAdoptionRequestPayload(pet.id, getValues(), requiresNeutering),
      );
      reset(
        getQuestionnaireDefaultValues({
          fullName: prefill.fullName,
          email: prefill.email,
        }),
      );
      goToStep(1);
      onSubmitted();
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmitError(error: unknown) {
    if (!(error instanceof ApiError)) {
      setGeneralError(ERROR_MESSAGES.unknown);
      return;
    }

    const fieldNames: string[] = [];
    const otherMessages: string[] = [];
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (QUESTIONNAIRE_FIELD_NAMES.has(field)) {
        fieldNames.push(field);
        setError(field as keyof AdoptionQuestionnaireValues, {
          type: "server",
          message: messages[0],
        });
      } else {
        // `pet`: duplicada, mascota no disponible o publicada por la misma persona
        otherMessages.push(...messages);
      }
    }

    setGeneralError(otherMessages[0] ?? error.message);
    const failedStep = getFirstStepWithError(fieldNames);
    if (failedStep) goToStep(failedStep);
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    // Enter en un campo avanza de paso; solo el último paso envía
    if (step < QUESTIONNAIRE_STEP_COUNT) {
      void handleNext();
      return;
    }
    void submitQuestionnaire();
  }

  if (!isOpen) return null;

  return (
    <div
      id="modal-adopcion"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-adopcion-pet-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[92vh] w-full max-w-lg space-y-6 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <span className="text-xs font-extrabold tracking-wider text-orange-700 uppercase dark:text-orange-400">
              Cuestionario Pre-Adopción
            </span>
            <h3
              id="modal-adopcion-pet-title"
              className="mt-0.5 font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Adoptar a {pet.name}
            </h3>
          </div>
          <button
            type="button"
            id="btn-close-adopcion"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-500 hover:text-slate-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-60 dark:text-slate-400 dark:hover:text-white"
            aria-label="Cerrar modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          id="form-adopcion-responsable"
          noValidate
          onSubmit={handleFormSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Paso {step} de {QUESTIONNAIRE_STEP_COUNT}
            </p>
            <h4
              ref={stepHeadingRef}
              tabIndex={-1}
              className="text-xs font-bold tracking-wider text-slate-500 uppercase focus:outline-hidden dark:text-slate-400"
            >
              {QUESTIONNAIRE_STEP_TITLES[step]}
            </h4>
          </div>

          {generalError ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {generalError}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-3">
              <TextField
                id="adopt-name"
                label="Nombre Completo"
                placeholder="Tu nombre y apellido"
                autoComplete="name"
                registration={register("full_name")}
                error={errors.full_name}
              />
              <TextField
                id="adopt-age"
                label="Edad"
                placeholder="Ej: 32"
                inputMode="numeric"
                help="Para adoptar tenés que ser mayor de 18 años."
                registration={register("age")}
                error={errors.age}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  id="adopt-phone"
                  label="WhatsApp / Teléfono"
                  type="tel"
                  placeholder="358 1234567"
                  autoComplete="tel"
                  registration={register("phone")}
                  error={errors.phone}
                />
                <TextField
                  id="adopt-email"
                  label="Correo Electrónico"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  autoComplete="email"
                  registration={register("email")}
                  error={errors.email}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  id="adopt-address"
                  label="Dirección"
                  placeholder="Calle y número"
                  autoComplete="street-address"
                  registration={register("address")}
                  error={errors.address}
                />
                <TextField
                  id="adopt-city"
                  label="Localidad"
                  placeholder="Ej: Río Cuarto"
                  autoComplete="address-level2"
                  registration={register("city")}
                  error={errors.city}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3">
              <TextField
                id="adopt-housing"
                label="Tipo de Vivienda"
                registration={register("housing_type")}
                error={errors.housing_type}
              />
              <RadioGroupField
                id="adopt-home-ownership"
                label="La vivienda es…"
                options={HOME_OWNERSHIP_OPTIONS}
                registration={register("home_ownership")}
                error={errors.home_ownership}
              />
              {homeOwnership === "rented" ? (
                <RadioGroupField
                  id="adopt-rental-allows-pets"
                  label="¿El contrato o el dueño permite animales?"
                  options={RENTAL_PETS_POLICY_OPTIONS}
                  registration={register("rental_allows_pets")}
                  error={errors.rental_allows_pets}
                />
              ) : null}
              <TextAreaField
                id="adopt-outdoor-space"
                label="¿Cómo es el patio, balcón o terraza, y qué protecciones tiene (cerco, red en ventanas)?"
                registration={register("outdoor_space")}
                error={errors.outdoor_space}
              />
              <TextAreaField
                id="adopt-household-members"
                label="¿Quiénes viven con vos?"
                help="Adultos, niños y edades aproximadas."
                registration={register("household_members")}
                error={errors.household_members}
              />
              <RadioGroupField
                id="adopt-household-agreement"
                label="¿Todos en tu casa están de acuerdo con la adopción?"
                options={HOUSEHOLD_AGREEMENT_OPTIONS}
                registration={register("household_agreement")}
                error={errors.household_agreement}
              />
              <TextField
                id="adopt-other-pets"
                label="¿Tenés otros animales actualmente?"
                placeholder="Ej: 1 perro castrado, 2 gatos vacunados..."
                registration={register("other_pets")}
                error={errors.other_pets}
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-3">
              <TextAreaField
                id="adopt-previous-pets"
                label="¿Tuviste animales antes? ¿Qué pasó con ellos?"
                registration={register("previous_pets")}
                error={errors.previous_pets}
              />
              <RadioGroupField
                id="adopt-hours-alone"
                label="¿Cuántas horas por día pasaría solo/a?"
                options={HOURS_ALONE_OPTIONS}
                registration={register("hours_alone")}
                error={errors.hours_alone}
              />
              <TextAreaField
                id="adopt-living-space"
                label="¿Dónde va a dormir y pasar el día?"
                registration={register("living_space")}
                error={errors.living_space}
              />
              <TextAreaField
                id="adopt-vacation-care"
                label="¿Quién lo cuida si viajás o te vas de vacaciones?"
                registration={register("vacation_care")}
                error={errors.vacation_care}
              />
              <TextAreaField
                id="adopt-contingency-plan"
                label="¿Qué harías si te mudás o no podés seguir cuidándolo?"
                registration={register("contingency_plan")}
                error={errors.contingency_plan}
              />
              <TextAreaField
                id="adopt-reason"
                label={`¿Por qué querés adoptar a ${pet.name}? (opcional)`}
                required={false}
                rows={3}
                registration={register("adoption_reason")}
                error={errors.adoption_reason}
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-3">
              <CheckboxField
                id="adopt-commitment"
                registration={register("accepts_commitment")}
                error={errors.accepts_commitment}
              >
                Me comprometo a brindar alimentación adecuada, atención
                veterinaria regular, mantener las vacunas al día y no abandonar
                a la mascota bajo ninguna circunstancia.
              </CheckboxField>
              {requiresNeutering ? (
                <CheckboxField
                  id="adopt-neutering"
                  registration={register("accepts_neutering")}
                  error={errors.accepts_neutering}
                >
                  Me comprometo a castrarlo/a cuando tenga la edad indicada.
                </CheckboxField>
              ) : null}
              <CheckboxField
                id="adopt-follow-up"
                registration={register("accepts_follow_up")}
                error={errors.accepts_follow_up}
              >
                Acepto que quien lo publicó me consulte cómo está, con fotos o
                mensajes, después de la adopción.
              </CheckboxField>
              <CheckboxField
                id="adopt-return-notice"
                registration={register("accepts_return_notice")}
                error={errors.accepts_return_notice}
              >
                Si no puedo seguir cuidándolo, aviso a Callejeros antes de darlo
                a otra persona.
              </CheckboxField>
              <CheckboxField
                id="adopt-truthful"
                registration={register("declares_truthful")}
                error={errors.declares_truthful}
              >
                Los datos son verdaderos y entiendo que enviar la solicitud no
                garantiza la adopción.
              </CheckboxField>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevious}
                disabled={isSubmitting}
                className={SECONDARY_BUTTON_CLASSES}
              >
                Anterior
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className={PRIMARY_BUTTON_CLASSES}
            >
              {step < QUESTIONNAIRE_STEP_COUNT
                ? "Siguiente"
                : isSubmitting
                  ? "Enviando solicitud…"
                  : "Enviar Solicitud de Adopción"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

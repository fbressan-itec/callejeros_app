import Image from "next/image";
import type { ReactNode } from "react";

import { formatAdoptionRequestDate } from "@/lib/adoptions/api";
import {
  buildQuestionnaireAnswerSections,
  getApplicantName,
} from "@/lib/adoptions/review";
import type { AdoptionRequestReview } from "@/lib/adoptions/types";
import { resolvePetImageUrl } from "@/lib/pets/api";

const SPECIES_LABELS = { dog: "🐶 Perro", cat: "🐱 Gato" } as const;
const SEX_LABELS = { male: "Macho", female: "Hembra" } as const;

export interface AdoptionReviewCardProps {
  request: AdoptionRequestReview;
  /** Botones para responder la solicitud. */
  children?: ReactNode;
}

export function AdoptionReviewCard({
  request,
  children,
}: AdoptionReviewCardProps) {
  const { pet } = request;
  const photoUrl = pet.main_photo ? resolvePetImageUrl(pet.main_photo) : "";
  const applicantName = getApplicantName(request);
  const titleId = `solicitud-${request.id}-titulo`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
            <Image
              src={photoUrl}
              alt={`Foto de ${pet.name}`}
              fill
              unoptimized
              sizes="64px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-2xl dark:bg-orange-950/60"
          >
            🐾
          </div>
        )}
        <div className="min-w-0">
          <span className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Solicitud de adopción
          </span>
          <h2
            id={titleId}
            className="truncate font-display text-lg font-bold text-slate-900 dark:text-white"
          >
            {pet.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {SPECIES_LABELS[pet.species]} • {SEX_LABELS[pet.sex]}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Solicitante
          </dt>
          <dd className="font-bold text-slate-800 dark:text-slate-100">
            {applicantName}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Enviada el
          </dt>
          <dd className="font-bold text-slate-800 dark:text-slate-100">
            {formatAdoptionRequestDate(request.created_at)}
          </dd>
        </div>
      </dl>

      <details className="group rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-850">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-slate-200">
          Ver cuestionario
          <svg
            className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </summary>
        <div className="flex flex-col gap-5 px-4 pt-1 pb-5">
          {buildQuestionnaireAnswerSections(request).map((section) => (
            <section key={section.step} className="flex flex-col gap-2">
              <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {section.title}
              </h3>
              <dl className="flex flex-col gap-2">
                {section.answers.map((answer) => (
                  <div key={answer.label}>
                    <dt className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {answer.label}
                    </dt>
                    <dd className="text-sm whitespace-pre-line text-slate-900 dark:text-white">
                      {answer.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </details>

      {children}
    </article>
  );
}

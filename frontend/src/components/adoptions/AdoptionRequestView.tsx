"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { BackButton } from "@/components/layout/BackButton";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import {
  buildMapSearchUrl,
  buildTelHref,
  fetchAdoptionRequestById,
  formatAdoptionRequestDate,
  isFinalAdoptionRequestStatus,
} from "@/lib/adoptions/api";
import type {
  AdoptionRequestDetail,
  FosterContact,
} from "@/lib/adoptions/types";
import { ApiError } from "@/lib/api/client";
import { ERROR_MESSAGES } from "@/lib/api/errors";
import { parsePositiveId } from "@/lib/api/ids";
import { usePollWhileVisible } from "@/lib/hooks/usePollWhileVisible";
import { resolvePetImageUrl } from "@/lib/pets/api";

/** Cada cuánto se vuelve a consultar una solicitud en revisión (con la pestaña visible). */
export const ADOPTION_REQUEST_POLL_INTERVAL_MS = 60_000;

const PRIMARY_BUTTON_CLASSES =
  "flex min-h-[44px] w-full items-center justify-center rounded-xl text-sm font-bold text-white transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900";
const SECONDARY_BUTTON_CLASSES =
  "flex min-h-[44px] w-full items-center justify-center rounded-xl text-sm font-bold text-slate-700 transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:text-slate-200 dark:focus-visible:ring-offset-slate-900";
const CARD_CLASSES =
  "flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800";
const CARD_TITLE_CLASSES =
  "font-display text-base font-bold text-slate-900 dark:text-white";

type FetchResult =
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "success"; request: AdoptionRequestDetail };

type FetchState = { status: "loading" } | FetchResult;

export interface AdoptionRequestViewProps {
  rawId: string;
}

export function AdoptionRequestView({ rawId }: AdoptionRequestViewProps) {
  const requestId = parsePositiveId(rawId);

  const [reloadCount, setReloadCount] = useState(0);
  const [fetched, setFetched] = useState<{
    key: string;
    result: FetchResult;
  } | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);

  const requestKey = requestId === null ? null : `${requestId}:${reloadCount}`;

  const handleRetry = useCallback(() => {
    setReloadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (requestId === null || requestKey === null) return;

    const controller = new AbortController();

    fetchAdoptionRequestById(requestId, { signal: controller.signal })
      .then((request) => {
        if (controller.signal.aborted) return;
        setFetched({ key: requestKey, result: { status: "success", request } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setFetched({ key: requestKey, result: { status: "not_found" } });
          return;
        }
        const message =
          error instanceof ApiError ? error.message : ERROR_MESSAGES.unknown;
        setFetched({ key: requestKey, result: { status: "error", message } });
      });

    return () => {
      controller.abort();
    };
  }, [requestId, requestKey]);

  // Consulta en segundo plano: si falla, se queda con lo último que llegó.
  const handlePoll = useCallback(() => {
    if (requestId === null || requestKey === null) return;

    pollControllerRef.current?.abort();
    const controller = new AbortController();
    pollControllerRef.current = controller;

    fetchAdoptionRequestById(requestId, { signal: controller.signal })
      .then((request) => {
        if (controller.signal.aborted) return;
        setFetched({ key: requestKey, result: { status: "success", request } });
      })
      .catch(() => {
        // Sin conexión o error momentáneo: se reintenta en la próxima consulta.
      });
  }, [requestId, requestKey]);

  useEffect(() => {
    return () => {
      pollControllerRef.current?.abort();
    };
  }, []);

  const state: FetchState =
    requestId === null
      ? { status: "not_found" }
      : fetched?.key === requestKey
        ? fetched.result
        : { status: "loading" };

  const isPending =
    state.status === "success" &&
    !isFinalAdoptionRequestStatus(state.request.status);

  usePollWhileVisible(handlePoll, ADOPTION_REQUEST_POLL_INTERVAL_MS, isPending);

  return (
    <main className="mx-auto flex w-full max-w-2xl grow flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
      {/* Botón Volver */}
      <div className="-mb-2">
        <BackButton fallbackHref="/" />
      </div>

      <section
        id="solicitud-detalle"
        className="flex flex-col gap-5"
        aria-live="polite"
      >
        {state.status === "loading" ? (
          <LoadingScreen message="Cargando solicitud..." />
        ) : null}

        {state.status === "not_found" ? <RequestNotFound /> : null}

        {state.status === "error" ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-white p-6 text-center shadow-soft dark:border-red-900/60 dark:bg-slate-800"
          >
            <span className="block text-3xl" aria-hidden="true">
              ⚠️
            </span>
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              No pudimos cargar tu solicitud
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {state.message}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 text-sm font-bold text-white transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-800"
            >
              Intentar de nuevo
            </button>
          </div>
        ) : null}

        {state.status === "success" ? (
          <RequestResult request={state.request} />
        ) : null}
      </section>
    </main>
  );
}

function RequestNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="block text-4xl" aria-hidden="true">
        📄
      </span>
      <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
        No encontramos esa solicitud
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Puede que no exista o que no tengas acceso.
      </p>
      <Link
        href="/adopciones"
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-700 px-5 text-sm font-bold text-white transition-all hover:bg-orange-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900"
      >
        Ver mascotas en adopción
      </Link>
    </div>
  );
}

function RequestResult({ request }: { request: AdoptionRequestDetail }) {
  if (request.status === "approved") {
    return <ApprovedResult request={request} />;
  }
  if (request.status === "rejected") {
    return <RejectedResult request={request} />;
  }
  return <PendingResult request={request} />;
}

function ResultHeader({
  icon,
  iconClassName,
  title,
  description,
}: {
  icon: string;
  iconClassName: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center">
      <div
        aria-hidden="true"
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${iconClassName}`}
      >
        {icon}
      </div>
      <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
        {title}
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {description}
      </p>
    </div>
  );
}

function PetSummaryCard({ request }: { request: AdoptionRequestDetail }) {
  const photoUrl = request.pet.main_photo
    ? resolvePetImageUrl(request.pet.main_photo)
    : "";

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-700 dark:bg-slate-800">
      {photoUrl ? (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
          <Image
            src={photoUrl}
            alt={`Foto de ${request.pet.name}`}
            fill
            unoptimized
            sizes="64px"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="min-w-0">
        <span className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Solicitud de adopción
        </span>
        <span className="block truncate font-display text-lg font-bold text-slate-900 dark:text-white">
          {request.pet.name}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          Enviada el {formatAdoptionRequestDate(request.created_at)}
        </span>
      </div>
    </div>
  );
}

function PendingResult({ request }: { request: AdoptionRequestDetail }) {
  return (
    <>
      <ResultHeader
        icon="⏳"
        iconClassName="animate-pulse bg-amber-100 motion-reduce:animate-none dark:bg-amber-950/60"
        title="Tu solicitud está en revisión"
        description="Un voluntario está leyendo tu cuestionario. Esta pantalla se actualiza sola cuando haya respuesta."
      />
      <PetSummaryCard request={request} />
    </>
  );
}

function ApprovedResult({ request }: { request: AdoptionRequestDetail }) {
  const contact = request.foster_contact;
  const petName = request.pet.name;

  return (
    <>
      <ResultHeader
        icon="🎉"
        iconClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        title="¡Solicitud aprobada!"
        description={`Gracias por elegir la adopción responsable. ${petName} está muy cerca de tener un hogar para siempre.`}
      />
      <PetSummaryCard request={request} />

      {contact ? <FosterContactCard contact={contact} /> : null}

      {contact?.shelter_public_address ? (
        <div className={CARD_CLASSES}>
          <h2 className={CARD_TITLE_CLASSES}>📍 Dirección del refugio</h2>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {contact.shelter_public_address}
          </p>
          <a
            href={buildMapSearchUrl(contact.shelter_public_address)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${SECONDARY_BUTTON_CLASSES} bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600`}
          >
            🗺️ Ver en el mapa
          </a>
        </div>
      ) : null}

      {/* Próximos pasos */}
      <div className={CARD_CLASSES}>
        <h2 className={CARD_TITLE_CLASSES}>Próximos pasos</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
          <li>
            {contact?.name
              ? `Coordiná el encuentro con ${contact.name}.`
              : "Coordiná el encuentro con quien lo publicó."}
          </li>
          <li>Conocé a {petName} y hacé todas las preguntas que necesites.</li>
          <li>Firmen el acta de adopción responsable.</li>
        </ol>
      </div>
    </>
  );
}

function FosterContactCard({ contact }: { contact: FosterContact }) {
  const phone = contact.contact_phone.trim();

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <h2 className={CARD_TITLE_CLASSES}>Contacto del hogar de tránsito</h2>
      <div className="text-sm text-slate-700 dark:text-slate-200">
        <span className="block font-bold">{contact.name}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {contact.role.name}
        </span>
        {phone ? <span className="mt-1 block font-mono">{phone}</span> : null}
      </div>
      {phone ? (
        <a
          href={buildTelHref(phone)}
          className={`${PRIMARY_BUTTON_CLASSES} bg-emerald-700 shadow-xs hover:bg-emerald-800 focus-visible:ring-emerald-500`}
        >
          📞 Llamar para coordinar
        </a>
      ) : null}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Por tu seguridad y la del animal, te recomendamos que el primer
        encuentro sea en un lugar público.
      </p>
    </div>
  );
}

function RejectedResult({ request }: { request: AdoptionRequestDetail }) {
  const reason = request.rejection_reason.trim();

  return (
    <>
      <ResultHeader
        icon="💛"
        iconClassName="bg-orange-100 dark:bg-orange-950/60"
        title="Esta vez no pudimos aprobar tu solicitud"
        description={`Gracias de corazón por querer darle un hogar a ${request.pet.name}. No es un "no" para siempre.`}
      />
      <PetSummaryCard request={request} />

      <div className={`${CARD_CLASSES} gap-2`}>
        <h2 className={CARD_TITLE_CLASSES}>¿Por qué?</h2>
        {reason ? (
          <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-200">
            {reason}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          ¡Te esperamos de nuevo! También podés ayudar apadrinando o como hogar
          de tránsito.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href="/adopcion-responsable"
          className={`${PRIMARY_BUTTON_CLASSES} bg-orange-700 shadow-md hover:bg-orange-800 focus-visible:ring-orange-500`}
        >
          📘 Aprender sobre Adopción Responsable
        </Link>
        <Link
          href="/donaciones#apadrinar"
          className={`${SECONDARY_BUTTON_CLASSES} bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700`}
        >
          Otras formas de ayudar
        </Link>
      </div>
    </>
  );
}

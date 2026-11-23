"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolvePetImageUrl } from "@/lib/pets/api";
import type { PetPhoto } from "@/lib/pets/types";

export interface PetPhotoCarouselProps {
  petName: string;
  description: string;
  photos: PetPhoto[];
  onSeeMore?: () => void;
}

export function PetPhotoCarousel({
  petName,
  description,
  photos,
  onSeeMore,
}: PetPhotoCarouselProps) {
  const orderedPhotos = useMemo(
    () =>
      [...photos]
        .sort((a, b) => a.position - b.position || a.id - b.id)
        .map((photo) => ({
          ...photo,
          resolvedUrl: resolvePetImageUrl(photo.image),
        }))
        .filter((photo) => Boolean(photo.resolvedUrl)),
    [photos],
  );

  const count = orderedPhotos.length;
  const multi = count > 1;

  const galleryRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLParagraphElement | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isSummaryClamped, setIsSummaryClamped] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  const clampIndex = useCallback(
    (index: number) => {
      if (count <= 0) return 0;
      return Math.max(0, Math.min(count - 1, index));
    },
    [count],
  );

  const goTo = useCallback(
    (index: number) => {
      const targetIndex = clampIndex(index);
      setActiveIndex(targetIndex);
      const gallery = galleryRef.current;
      if (gallery && typeof gallery.scrollTo === "function") {
        gallery.scrollTo({
          left: targetIndex * gallery.clientWidth,
          behavior: "smooth",
        });
      }
    },
    [clampIndex],
  );

  function handleScroll() {
    const gallery = galleryRef.current;
    if (!gallery || gallery.clientWidth <= 0) return;
    const nextIndex = clampIndex(
      Math.round(gallery.scrollLeft / gallery.clientWidth),
    );
    setActiveIndex(nextIndex);
  }

  useEffect(() => {
    const summary = summaryRef.current;
    if (!summary) return;

    const checkOverflow = () => {
      if (isSummaryExpanded) return;
      setIsSummaryClamped(summary.scrollHeight > summary.clientHeight + 1);
    };

    checkOverflow();

    window.addEventListener("resize", checkOverflow);
    return () => {
      window.removeEventListener("resize", checkOverflow);
    };
  }, [description, isSummaryExpanded]);

  function handleSeeMoreClick() {
    if (onSeeMore) {
      onSeeMore();
      return;
    }
    setIsSummaryExpanded((prev) => !prev);
  }

  const displayIndex = clampIndex(activeIndex);

  return (
    <>
      <section
        className="relative h-[380px] overflow-hidden rounded-3xl bg-slate-200 shadow-soft sm:h-[460px] dark:bg-slate-800"
        aria-roledescription="carrusel"
        aria-label={`Fotos de ${petName}`}
      >
        {count > 0 ? (
          <div
            ref={galleryRef}
            id="pet-gallery"
            onScroll={handleScroll}
            className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
          >
            {orderedPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative h-full w-full shrink-0 snap-center"
              >
                <Image
                  src={photo.resolvedUrl}
                  alt={`Foto ${index + 1} de ${count} de ${petName}`}
                  fill
                  unoptimized
                  priority={index === 0}
                  sizes="(min-width: 768px) 768px, 100vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="text-4xl" aria-hidden="true">
              🐾
            </span>
            <p className="text-sm font-medium">Sin fotos disponibles</p>
          </div>
        )}

        {multi ? (
          <>
            <span
              id="pet-photo-counter"
              aria-live="polite"
              className="pointer-events-none absolute top-3 right-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-xs"
            >
              {displayIndex + 1} / {count}
            </span>

            <button
              type="button"
              id="pet-photo-prev"
              onClick={() => goTo(displayIndex - 1)}
              aria-label="Foto anterior"
              className="absolute top-1/3 left-3 hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-950/60 text-white backdrop-blur-xs transition-all hover:bg-slate-950/80 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 sm:flex"
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
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <button
              type="button"
              id="pet-photo-next"
              onClick={() => goTo(displayIndex + 1)}
              aria-label="Foto siguiente"
              className="absolute top-1/3 right-3 hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-950/60 text-white backdrop-blur-xs transition-all hover:bg-slate-950/80 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 sm:flex"
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
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/95 via-slate-950/70 to-transparent p-5 pt-20">
          <p
            ref={summaryRef}
            id="pet-summary"
            className={`text-sm leading-relaxed text-white ${
              isSummaryExpanded ? "" : "line-clamp-2"
            }`}
          >
            {description}
          </p>
          {isSummaryClamped || isSummaryExpanded ? (
            <button
              type="button"
              id="btn-pet-more"
              onClick={handleSeeMoreClick}
              className="pointer-events-auto mt-1 -mb-3 min-h-[44px] rounded-sm text-sm font-bold text-orange-300 underline underline-offset-4 hover:text-orange-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              {isSummaryExpanded && !onSeeMore ? "Ver menos" : "Ver más"}
            </button>
          ) : null}
        </div>
      </section>

      {multi ? (
        <div
          className="-mt-2 flex justify-center"
          role="group"
          aria-label="Elegir foto"
        >
          {orderedPhotos.map((photo, index) => {
            const isActive = index === displayIndex;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Ver foto ${index + 1}`}
                aria-current={isActive ? "true" : "false"}
                className="pet-dot flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <span
                  className={`block h-2.5 rounded-full transition-all ${
                    isActive
                      ? "w-8 bg-orange-500"
                      : "w-2.5 bg-slate-300 dark:bg-slate-600"
                  }`}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

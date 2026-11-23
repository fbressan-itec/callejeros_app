"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";

/** Tiempo entre slides del autoavance (igual al maquetado). */
export const HERO_AUTOPLAY_MS = 6000;
/** Distancia mínima del gesto horizontal para cambiar de slide. */
const SWIPE_MIN_DISTANCE_PX = 40;

interface HeroAction {
  href: string;
  label: string;
  /** "primary" lleva el color del slide; "glass" es el botón translúcido. */
  variant: "primary" | "glass";
  icon?: ReactNode;
}

interface HeroSlide {
  id: string;
  tag: string;
  title: string;
  text: string;
  image: string;
  imageAlt: string;
  /** Oscurecido de la foto, como en el maquetado. */
  imageBrightnessClass: string;
  tagClass: string;
  primaryClass: string;
  actions: HeroAction[];
}

const ArrowRightIcon = (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M14 5l7 7m0 0l-7 7m7-7H3"
    />
  </svg>
);

const WarningIcon = (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const HeartIcon = (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  </svg>
);

/*
 * Slides institucionales del inicio (textos iguales a contexto-ia/maquetado/index.html).
 * Es contenido fijo de la organización, no datos de la base.
 *
 * FOTOS DE PRUEBA: las imágenes de /public/images/inicio/ se bajaron de Unsplash
 * (las mismas del maquetado) solo para desarrollo. Reemplazarlas por fotos propias
 * de Callejeros manteniendo el nombre del archivo:
 * - hero-adopcion-perro-feliz.jpg   → slide 1 "Adopción Responsable": perro rescatado sonriendo.
 * - hero-alerta-perro-callejero.jpg → slide 2 "Alerta Comunitaria": perro callejero con mirada atenta.
 * - hero-campana-gato.jpg           → slide 3 "Campaña Solidaria": gato descansando.
 */
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "adopcion",
    tag: "Adopción Responsable",
    title: "Dales una segunda oportunidad en Río Cuarto",
    text: "Cientos de callejeritos esperan un hogar que los llene de amor. Conocé sus historias hoy.",
    image: "/images/inicio/hero-adopcion-perro-feliz.jpg",
    imageAlt: "Perro rescatado feliz en Río Cuarto",
    imageBrightnessClass: "brightness-[0.70]",
    tagClass: "bg-orange-700",
    primaryClass:
      "bg-orange-700 hover:bg-orange-800 shadow-lg shadow-orange-700/30",
    actions: [
      {
        href: "/adopciones",
        label: "Ver Mascotas",
        variant: "primary",
        icon: ArrowRightIcon,
      },
      { href: "/quienes-somos", label: "Conocé Más", variant: "glass" },
    ],
  },
  {
    id: "alerta",
    tag: "Alerta Comunitaria",
    title: "¿Viste una mascota perdida o en riesgo?",
    text: "Reportala al instante en nuestro mapa geolocalizado para coordinar rescates comunitarios.",
    image: "/images/inicio/hero-alerta-perro-callejero.jpg",
    imageAlt: "Perro callejero con mirada atenta",
    imageBrightnessClass: "brightness-[0.65]",
    tagClass: "bg-red-600",
    primaryClass: "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30",
    actions: [
      {
        href: "/alertas",
        label: "Emitir Reporte",
        variant: "primary",
        icon: WarningIcon,
      },
    ],
  },
  {
    id: "campana",
    tag: "Campaña Solidaria",
    title: "Tu ayuda salva vidas cada fin de semana",
    text: "Donaciones de alimento balanceado, mantas y atención veterinaria para los hogares de tránsito.",
    image: "/images/inicio/hero-campana-gato.jpg",
    imageAlt: "Gato descansando tranquilo",
    imageBrightnessClass: "brightness-[0.65]",
    tagClass: "bg-emerald-700",
    primaryClass:
      "bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/30",
    actions: [
      {
        href: "/donaciones",
        label: "Quiero Colaborar",
        variant: "primary",
        icon: HeartIcon,
      },
    ],
  },
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

export function HeroCarousel() {
  const count = HERO_SLIDES.length;
  const [current, setCurrent] = useState(0);
  // Se pausa mientras el mouse o el foco del teclado están en el carrusel (WCAG 2.2.2).
  const [isPaused, setIsPaused] = useState(false);
  // Cambia cada vez que la persona interactúa, para reiniciar el autoavance.
  const [interactionKey, setInteractionKey] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % count) + count) % count);
      setInteractionKey((key) => key + 1);
    },
    [count],
  );

  useEffect(() => {
    if (prefersReducedMotion || isPaused || count < 2) return;
    const timer = setInterval(() => {
      setCurrent((index) => (index + 1) % count);
    }, HERO_AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count, isPaused, prefersReducedMotion, interactionKey]);

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  // Deslizar con el dedo: izquierda = siguiente, derecha = anterior.
  // Solo cuenta si el gesto es más horizontal que vertical, para no trabar el scroll.
  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy)) {
      return;
    }
    goTo(dx < 0 ? current + 1 : current - 1);
  }

  return (
    <section
      id="hero-carousel"
      className="relative w-full touch-pan-y overflow-hidden bg-slate-950"
      aria-roledescription="carrusel"
      aria-label="Novedades destacadas"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
    >
      <div className="relative h-[440px] w-full sm:h-[500px] md:h-[560px]">
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === current;
          const TitleTag = index === 0 ? "h1" : "h2";
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} de ${count}`}
              aria-hidden={!isActive}
              inert={!isActive}
              data-active={isActive ? "true" : "false"}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
                isActive ? "z-10 opacity-100" : "z-0 opacity-0"
              }`}
            >
              <Image
                src={slide.image}
                alt={slide.imageAlt}
                fill
                sizes="100vw"
                preload={index === 0}
                className={`object-cover ${slide.imageBrightnessClass}`}
              />
              <div className="pointer-events-none absolute inset-0 h-full w-full bg-linear-to-t from-slate-950 via-slate-950/60 to-slate-950/25" />
              <div className="pointer-events-none absolute inset-0 z-10 mx-auto flex h-full w-full max-w-7xl flex-col justify-end px-4 pb-12 sm:px-8 sm:pb-16 lg:px-12 xl:px-16 2xl:max-w-(--breakpoint-2xl) 2xl:px-20">
                <div className="pointer-events-auto max-w-3xl space-y-2 sm:space-y-3">
                  <span
                    className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-bold tracking-wider text-white uppercase shadow-md ${slide.tagClass}`}
                  >
                    {slide.tag}
                  </span>
                  <TitleTag className="font-display text-2xl leading-tight font-extrabold text-white drop-shadow-md sm:text-4xl sm:leading-10 md:text-5xl md:leading-none">
                    {slide.title}
                  </TitleTag>
                  <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-slate-200 drop-shadow-xs sm:text-base sm:leading-6">
                    {slide.text}
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    {slide.actions.map((action) => (
                      <Link
                        key={action.href}
                        href={action.href}
                        className={
                          action.variant === "primary"
                            ? `inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-95 ${slide.primaryClass}`
                            : "inline-flex min-h-[44px] items-center rounded-xl bg-white/20 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/30 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-95"
                        }
                      >
                        <span>{action.label}</span>
                        {action.icon}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Flechas solo desde tablet: en el celular tapan el texto y se desliza con el dedo. */}
      <button
        type="button"
        onClick={() => goTo(current - 1)}
        aria-label="Slide anterior"
        className="absolute top-1/2 left-3 z-20 hidden min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/60 text-white backdrop-blur-xs transition-all hover:bg-slate-900/80 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-90 sm:inline-flex"
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
        onClick={() => goTo(current + 1)}
        aria-label="Slide siguiente"
        className="absolute top-1/2 right-3 z-20 hidden min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/60 text-white backdrop-blur-xs transition-all hover:bg-slate-900/80 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-90 sm:inline-flex"
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

      {/* Puntitos: botón de 44px (táctil) con la barrita visible adentro. */}
      <div
        className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-center"
        role="group"
        aria-label="Elegir slide"
      >
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === current;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Ir al slide ${index + 1}`}
              aria-current={isActive ? "true" : undefined}
              className="group flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <span
                className={`block h-2.5 rounded-full transition-all ${
                  isActive
                    ? "w-8 bg-orange-500"
                    : "w-2.5 bg-white/40 group-hover:bg-white/70"
                }`}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

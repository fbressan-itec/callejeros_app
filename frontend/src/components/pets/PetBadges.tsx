"use client";

import { type ReactNode, useState } from "react";

import type { PetBadge, PetBadgeIcon, PetBadgeTone } from "@/lib/pets/types";

const INITIAL_CAPTION = "Tocá una insignia para ver qué significa";

const BADGE_TONE_CLASSES: Record<PetBadgeTone, string> = {
  neutral:
    "bg-white border-slate-300 text-slate-700 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100",
  sky: "bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950/60 dark:border-sky-800 dark:text-sky-300",
  pink: "bg-pink-100 border-pink-300 text-pink-700 dark:bg-pink-950/60 dark:border-pink-800 dark:text-pink-300",
  orange:
    "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-950/60 dark:border-orange-800 dark:text-orange-300",
  green:
    "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300",
  amber:
    "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300",
  gray: "bg-slate-200 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400",
  blue: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300",
  urgent: "bg-rose-600 border-rose-700 text-white dark:border-rose-400",
};

function AgeBarsIcon({ filled }: { filled: 1 | 2 | 3 }) {
  const bars: Array<[number, number, number]> = [
    [4, 14, 6],
    [10, 10, 10],
    [16, 5, 15],
  ];
  return (
    <>
      {bars.map(([x, y, height], index) => (
        <rect
          key={x}
          x={x}
          y={y}
          width="4"
          height={height}
          rx="1"
          fill={index < filled ? "currentColor" : "none"}
        />
      ))}
    </>
  );
}

function renderBadgeIcon(icon: PetBadgeIcon): ReactNode {
  switch (icon) {
    case "adopted":
      return (
        <>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M12 16.5s-3-1.9-3-3.8a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 1.9-3 3.8-3 3.8Z" />
        </>
      );
    case "urgent":
      return (
        <>
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </>
      );
    case "dog":
      return (
        <>
          <path d="M8 6.5a4 4 0 0 1 8 0V12a4 4 0 0 1-8 0z" />
          <path d="M8 7 4.5 5.5v6L8 13M16 7l3.5-1.5v6L16 13" />
          <path d="M11 13.5h2l-1 1.2z" />
          <path d="M10 10h.01M14 10h.01" />
        </>
      );
    case "cat":
      return (
        <>
          <path d="M5 10V4l4 3h6l4-3v6a7 7 0 1 1-14 0z" />
          <path d="M9.5 12h.01M14.5 12h.01" />
          <path d="M11 15h2l-1 1z" />
        </>
      );
    case "male":
      return (
        <>
          <circle cx="10" cy="14" r="5" />
          <path d="M13.5 10.5 19 5M15 5h4v4" />
        </>
      );
    case "female":
      return (
        <>
          <circle cx="12" cy="9" r="5" />
          <path d="M12 14v7M9 18h6" />
        </>
      );
    case "age_cachorro":
      return <AgeBarsIcon filled={1} />;
    case "age_adulto":
      return <AgeBarsIcon filled={2} />;
    case "age_senior":
      return <AgeBarsIcon filled={3} />;
    case "sociable":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14a4 4 0 0 0 7 0" />
          <path d="M9 9.5h.01M15 9.5h.01" />
        </>
      );
    case "wild":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 15.5h7" />
          <path d="m7.5 8 3 1.5M16.5 8l-3 1.5" />
        </>
      );
    case "children":
      return (
        <>
          <circle cx="9" cy="7" r="3" />
          <path d="M3 20v-1a6 6 0 0 1 12 0v1" />
          <circle cx="17.5" cy="11" r="2" />
          <path d="M14.5 20v-.5a3 3 0 0 1 6 0v.5" />
        </>
      );
    case "animals":
      return (
        <>
          <ellipse cx="12" cy="16" rx="4" ry="3.5" />
          <circle cx="6.5" cy="10.5" r="1.7" />
          <circle cx="10" cy="6.5" r="1.7" />
          <circle cx="14" cy="6.5" r="1.7" />
          <circle cx="17.5" cy="10.5" r="1.7" />
        </>
      );
    case "neutered":
      return (
        <>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M8.1 8.1 20 20M8.1 15.9 20 4" />
        </>
      );
    case "not_neutered":
      return (
        <>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M8.1 8.1 20 20M8.1 15.9 20 4" />
          <path d="M3 21 21 3" strokeWidth="2.5" />
        </>
      );
    case "health":
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </>
      );
  }
}

export interface PetBadgesProps {
  petName: string;
  badges: PetBadge[];
}

export function PetBadges({ petName, badges }: PetBadgesProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (badges.length === 0) return null;

  const activeBadge = badges.find((badge) => badge.key === activeKey) ?? null;
  const caption = activeBadge ? activeBadge.text : INITIAL_CAPTION;

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-800/60"
      aria-label={`Resumen de ${petName}`}
    >
      <ul className="flex flex-wrap justify-center gap-2">
        {badges.map((badge) => {
          const isSelected = activeKey === badge.key;
          const toneClasses =
            BADGE_TONE_CLASSES[badge.tone] ?? BADGE_TONE_CLASSES.neutral;

          return (
            <li key={badge.key}>
              <button
                type="button"
                onClick={() => setActiveKey(badge.key)}
                onMouseEnter={() => setActiveKey(badge.key)}
                onFocus={() => setActiveKey(badge.key)}
                title={badge.text}
                aria-label={badge.text}
                aria-pressed={isSelected}
                className={`pet-badge flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-800 ${toneClasses} ${
                  isSelected ? "ring-2 ring-orange-500" : ""
                }`}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  {renderBadgeIcon(badge.icon)}
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
      <p
        id="pet-badge-caption"
        className="mt-2 flex min-h-[2.5rem] items-center justify-center text-center text-xs font-semibold text-slate-600 dark:text-slate-300"
        aria-live="polite"
      >
        {caption}
      </p>
    </section>
  );
}

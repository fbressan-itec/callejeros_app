"use client";

import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";

import { AdoptionReviewQueue } from "@/components/staff/AdoptionReviewQueue";

interface StaffPanelTab {
  id: string;
  label: string;
  content: () => ReactNode;
}

/** Pestañas del panel. Las publicaciones en revisión se suman en FR-10b (#150). */
const STAFF_PANEL_TABS: readonly StaffPanelTab[] = [
  {
    id: "solicitudes",
    label: "📋 Solicitudes de adopción",
    content: () => <AdoptionReviewQueue />,
  },
];

export function StaffPanel() {
  const [activeId, setActiveId] = useState(STAFF_PANEL_TABS[0]?.id ?? "");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeTab =
    STAFF_PANEL_TABS.find((tab) => tab.id === activeId) ?? STAFF_PANEL_TABS[0];

  // Flechas, Inicio y Fin mueven entre pestañas (patrón de pestañas de WAI-ARIA)
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = STAFF_PANEL_TABS.findIndex((tab) => tab.id === activeId);
    const last = STAFF_PANEL_TABS.length - 1;
    const nextIndex =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = STAFF_PANEL_TABS[nextIndex];
    if (!next) return;
    setActiveId(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl grow flex-col gap-6 px-4 pt-8 pb-24 sm:px-8 sm:pt-12">
      <header className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full bg-violet-500"
            aria-hidden="true"
          />
          <span className="text-xs font-extrabold tracking-wider text-violet-700 uppercase dark:text-violet-300">
            🛡️ Staff Callejeros
          </span>
        </div>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-slate-900 sm:text-4xl dark:text-white">
          Panel de Staff
        </h1>
        <p className="mt-1 max-w-2xl text-xs text-slate-600 sm:text-sm dark:text-slate-400">
          Revisá y respondé lo que envía la comunidad.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Secciones del panel de Staff"
        className="flex flex-wrap items-center gap-1 self-start rounded-xl bg-slate-200/80 p-1 text-xs font-semibold dark:bg-slate-800"
      >
        {STAFF_PANEL_TABS.map((tab) => {
          const isActive = tab.id === activeTab?.id;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[tab.id] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={handleTabKeyDown}
              className={`min-h-[44px] rounded-lg px-3 py-1.5 transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 dark:focus-visible:ring-offset-slate-900 ${
                isActive
                  ? "bg-orange-700 text-white shadow-md hover:bg-orange-800"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab ? (
        <section
          role="tabpanel"
          id={`panel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
        >
          {activeTab.content()}
        </section>
      ) : null}
    </main>
  );
}

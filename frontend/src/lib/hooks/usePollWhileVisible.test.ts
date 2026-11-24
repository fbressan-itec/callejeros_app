import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePollWhileVisible } from "@/lib/hooks/usePollWhileVisible";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(value: DocumentVisibilityState) {
  visibility = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePollWhileVisible", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("consulta cada intervalo con la pestaña visible", () => {
    const onPoll = vi.fn();
    renderHook(() => usePollWhileVisible(onPoll, 60_000, true));

    vi.advanceTimersByTime(59_999);
    expect(onPoll).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onPoll).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(onPoll).toHaveBeenCalledTimes(2);
  });

  it("no consulta con la pestaña oculta y consulta al volver", () => {
    const onPoll = vi.fn();
    renderHook(() => usePollWhileVisible(onPoll, 60_000, true));

    setVisibility("hidden");
    vi.advanceTimersByTime(180_000);
    expect(onPoll).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(onPoll).toHaveBeenCalledTimes(1);

    // Retoma el intervalo desde que volvió
    vi.advanceTimersByTime(60_000);
    expect(onPoll).toHaveBeenCalledTimes(2);
  });

  it("no arranca si la pestaña ya estaba oculta al montar", () => {
    visibility = "hidden";
    const onPoll = vi.fn();
    renderHook(() => usePollWhileVisible(onPoll, 60_000, true));

    vi.advanceTimersByTime(120_000);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it("se corta al deshabilitarlo y no reacciona a la pestaña", () => {
    const onPoll = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => usePollWhileVisible(onPoll, 60_000, enabled),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    vi.advanceTimersByTime(120_000);
    setVisibility("hidden");
    setVisibility("visible");
    expect(onPoll).not.toHaveBeenCalled();
  });

  it("deja de consultar al desmontar", () => {
    const onPoll = vi.fn();
    const { unmount } = renderHook(() =>
      usePollWhileVisible(onPoll, 60_000, true),
    );

    unmount();
    vi.advanceTimersByTime(120_000);
    setVisibility("visible");
    expect(onPoll).not.toHaveBeenCalled();
  });
});

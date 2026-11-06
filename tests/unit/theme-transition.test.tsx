import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { ThemeProvider } from "../../src/lib/theme";
import { useTheme } from "../../src/lib/theme-context";
import type { ThemeMode } from "../../src/lib/theme-context";
import "../../src/i18n";

/** Transmet le réglage de thème au test (sans affecter de variable pendant le rendu). */
function Probe({ onReady }: { onReady: (setTheme: (mode: ThemeMode) => void) => void }) {
  const { setTheme } = useTheme();
  useEffect(() => onReady(setTheme), [onReady, setTheme]);
  return null;
}

function setStartViewTransition(fn: ((update: () => void) => unknown) | undefined) {
  if (fn) {
    Object.defineProperty(document, "startViewTransition", { value: fn, configurable: true, writable: true });
  } else {
    Reflect.deleteProperty(document, "startViewTransition");
  }
}

function mount() {
  let setMode: ((mode: ThemeMode) => void) | undefined;
  render(
    <ThemeProvider>
      <Probe onReady={(fn) => (setMode = fn)} />
    </ThemeProvider>,
  );
  return (mode: ThemeMode) => act(() => setMode?.(mode));
}

describe("changement de thème", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
  });
  afterEach(() => {
    setStartViewTransition(undefined);
  });

  it("passe par une transition de vue quand le navigateur la gère, sans classe forcée", () => {
    const start = vi.fn((update: () => void) => update());
    setStartViewTransition(start);
    const setMode = mount();

    expect(start).not.toHaveBeenCalled(); // premier affichage : pas de fondu
    setMode("dark");
    expect(start).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);
  });

  it("sans transition de vue, la bascule est immédiate", () => {
    const setMode = mount();
    setMode("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    setMode("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useLongPress } from "../../src/lib/long-press";

function Target({ onLong, onTap }: { onLong?: () => void; onTap: () => void }) {
  const props = useLongPress(onLong);
  return (
    <button
      type="button"
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) onTap();
      }}
    >
      ligne
    </button>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("appui long", () => {
  it("ouvre le menu après le maintien, sans déclencher le clic qui suit", () => {
    const onLong = vi.fn();
    const onTap = vi.fn();
    render(<Target onLong={onLong} onTap={onTap} />);
    const row = screen.getByRole("button");
    fireEvent.pointerDown(row, { clientX: 10, clientY: 10, pointerType: "touch" });
    vi.advanceTimersByTime(500);
    fireEvent.pointerUp(row);
    fireEvent.click(row);
    expect(onLong).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("un appui court reste un simple toucher", () => {
    const onLong = vi.fn();
    const onTap = vi.fn();
    render(<Target onLong={onLong} onTap={onTap} />);
    const row = screen.getByRole("button");
    fireEvent.pointerDown(row, { clientX: 10, clientY: 10, pointerType: "touch" });
    vi.advanceTimersByTime(100);
    fireEvent.pointerUp(row);
    fireEvent.click(row);
    vi.advanceTimersByTime(1000);
    expect(onLong).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("le défilement annule le maintien", () => {
    const onLong = vi.fn();
    render(<Target onLong={onLong} onTap={vi.fn()} />);
    const row = screen.getByRole("button");
    fireEvent.pointerDown(row, { clientX: 10, clientY: 10, pointerType: "touch" });
    fireEvent.pointerMove(row, { clientX: 10, clientY: 60 });
    vi.advanceTimersByTime(1000);
    expect(onLong).not.toHaveBeenCalled();
  });

  it("le menu du navigateur (clic droit, maintien Android) ouvre aussi le menu", () => {
    const onLong = vi.fn();
    render(<Target onLong={onLong} onTap={vi.fn()} />);
    fireEvent.contextMenu(screen.getByRole("button"));
    expect(onLong).toHaveBeenCalledTimes(1);
  });
});

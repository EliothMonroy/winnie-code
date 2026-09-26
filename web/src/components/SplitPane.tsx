import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { readStorage, storageKeys, writeStorage } from "../storage";

type Props = {
  direction: "horizontal" | "vertical";
  /** Name used for the persisted size (localStorage winnie:split:<name>). */
  storageKey: string;
  /** Initial size of the first pane, in percent. */
  initial: number;
  /** Minimum size of either pane, in percent. */
  min?: number;
  children: [ReactNode, ReactNode];
};

export function SplitPane({ direction, storageKey, initial, min = 15, children }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const horizontal = direction === "horizontal";
  const clamp = (value: number) => Math.min(100 - min, Math.max(min, value));
  const [size, setSize] = useState(() => {
    const stored = Number(readStorage(storageKeys.split(storageKey)));
    return stored > 0 ? clamp(stored) : initial;
  });

  function update(value: number) {
    const next = clamp(value);
    setSize(next);
    writeStorage(storageKeys.split(storageKey), next.toFixed(1));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!container.current) return;
    e.preventDefault();
    const divider = e.currentTarget;
    const rect = container.current.getBoundingClientRect();
    divider.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing");
    const onMove = (ev: PointerEvent) =>
      update(horizontal ? ((ev.clientX - rect.left) / rect.width) * 100 : ((ev.clientY - rect.top) / rect.height) * 100);
    const onUp = () => {
      divider.removeEventListener("pointermove", onMove);
      divider.removeEventListener("pointerup", onUp);
      divider.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("resizing");
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onUp);
    divider.addEventListener("pointercancel", onUp);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const decrease = horizontal ? "ArrowLeft" : "ArrowUp";
    const increase = horizontal ? "ArrowRight" : "ArrowDown";
    if (e.key === decrease || e.key === increase) {
      e.preventDefault();
      update(size + (e.key === increase ? 2 : -2));
    }
  }

  return (
    <div ref={container} className={`split split-${direction}`}>
      <div className="split-pane" style={{ flexBasis: `${size}%` }}>
        {children[0]}
      </div>
      <div
        className="split-divider"
        role="separator"
        tabIndex={0}
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(size)}
        aria-valuemin={min}
        aria-valuemax={100 - min}
        aria-label="Resize panels"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      />
      <div className="split-pane split-pane-rest">{children[1]}</div>
    </div>
  );
}

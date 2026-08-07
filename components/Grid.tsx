// components/Grid.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import {
  CELL_DEFAULT,
  CELL_MAX,
  CELL_MIN,
  getCellSize,
  setCellSize,
} from "@/lib/session";

export type Flash = "found" | "invalid" | "duplicate" | null;

const FLASH_RING: Record<Exclude<Flash, null>, string> = {
  found: "ring-4 ring-emerald-400",
  invalid: "animate-shake",
  duplicate: "animate-shake",
};

// Board geometry in viewBox units. Gaps and padding are a fixed fraction of a
// tile, so the whole board scales uniformly and the trace overlay can use one
// fixed viewBox at any size — no measuring the DOM.
const TILE = 100;
const GUTTER = 15; // both the gap between tiles and the board's own padding
const SPAN = 4 * TILE + 5 * GUTTER; // 4 tiles + 3 gaps + 2 edges
const GUTTER_RATIO = GUTTER / TILE;
const BOARD_TILES = SPAN / TILE; // board width measured in tiles

const centerOf = (i: number) => ({
  x: GUTTER + (i % 4) * (TILE + GUTTER) + TILE / 2,
  y: GUTTER + Math.floor(i / 4) * (TILE + GUTTER) + TILE / 2,
});

// Dragging the corner by n px widens the board by n px, and the board is
// BOARD_TILES tiles wide, so the tile grows n / (BOARD_TILES * 16) rem.
const PX_PER_REM_OF_CELL = BOARD_TILES * 16;
const clampCell = (rem: number) =>
  Math.min(CELL_MAX, Math.max(CELL_MIN, Math.round(rem * 10) / 10));

const KEY_STEP: Record<string, number | undefined> = {
  ArrowRight: 0.5,
  ArrowUp: 0.5,
  ArrowLeft: -0.5,
  ArrowDown: -0.5,
};

const adjacent = (a: number, b: number) => {
  const dr = Math.abs(Math.floor(a / 4) - Math.floor(b / 4));
  const dc = Math.abs((a % 4) - (b % 4));
  return a !== b && dr <= 1 && dc <= 1;
};

export function Grid({
  letters,
  flash,
  onWord,
}: {
  letters: string[];
  flash: Flash;
  onWord: (word: string) => void;
}) {
  const [path, setPath] = useState<number[]>([]);
  const [cell, setCell] = useState(CELL_DEFAULT);
  const tracing = useRef(false);
  // `latest` mirrors the dragged size: a pointerup in the same frame as the
  // last pointermove would otherwise persist a stale value from its closure.
  const drag = useRef<{ x: number; y: number; cell: number; latest: number } | null>(
    null
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only SSR hydration guard: localStorage is unreadable during SSR, so we sync it once the client mounts.
    setCell(getCellSize());
  }, []);

  // Dead zone between cells so diagonal swipes don't clip neighbors.
  const cellAt = (x: number, y: number): number | null => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest("[data-idx]") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const dist = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (dist > r.width * 0.4) return null;
    return Number(el.dataset.idx);
  };

  const extend = (idx: number | null) => {
    if (idx === null) return;
    setPath((p) => {
      if (p.length === 0) return [idx];
      if (p.length > 1 && p[p.length - 2] === idx) return p.slice(0, -1); // backtrack undo
      if (p.includes(idx) || !adjacent(p[p.length - 1], idx)) return p;
      return [...p, idx];
    });
  };

  const finish = () => {
    if (!tracing.current) return;
    tracing.current = false;
    if (path.length >= 4) onWord(path.map((i) => letters[i]).join(""));
    setPath([]);
  };

  const current = path.map((i) => letters[i]).join("").toUpperCase();

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 text-2xl font-bold tracking-widest text-indigo-600 dark:text-indigo-400">
        {current || " "}
      </div>
      <div
        className="relative"
        // Shrink below the preferred size rather than overflow a narrow screen.
        style={
          {
            "--cell": `min(${cell}rem, calc((100vw - 2.5rem) / ${BOARD_TILES}))`,
          } as React.CSSProperties
        }
      >
        <div
          className={`relative grid grid-cols-[repeat(4,var(--cell))] rounded-2xl bg-neutral-200 select-none touch-none dark:bg-neutral-800 ${
            flash ? FLASH_RING[flash] : ""
          }`}
          style={{
            gap: `calc(var(--cell) * ${GUTTER_RATIO})`,
            padding: `calc(var(--cell) * ${GUTTER_RATIO})`,
          }}
          onPointerDown={(e) => {
            tracing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            extend(cellAt(e.clientX, e.clientY));
          }}
          onPointerMove={(e) => {
            if (tracing.current) extend(cellAt(e.clientX, e.clientY));
          }}
          onPointerUp={finish}
          onPointerCancel={() => {
            tracing.current = false;
            setPath([]);
          }}
        >
          {letters.map((ch, i) => (
            <div
              key={i}
              data-idx={i}
              style={{ fontSize: "calc(var(--cell) * 0.42)" }}
              // `transition` (not `transition-all`) so font-size snaps with the
              // tile during a resize drag instead of lagging behind it.
              className={`flex aspect-square items-center justify-center rounded-xl font-bold uppercase transition ${
                path.includes(i)
                  ? "scale-105 bg-indigo-600 text-white"
                  : "bg-white text-neutral-800 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
              }`}
            >
              {ch}
            </div>
          ))}
          {path.length > 1 && (
            <svg
              viewBox={`0 0 ${SPAN} ${SPAN}`}
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full text-indigo-500/45 dark:text-indigo-400/45"
            >
              <polyline
                points={path
                  .map((i) => {
                    const { x, y } = centerOf(i);
                    return `${x},${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth={TILE * 0.22}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <button
          type="button"
          aria-label="Resize board"
          title="Drag to resize the board"
          className="absolute -right-1 -bottom-1 h-5 w-5 cursor-nwse-resize touch-none rounded-br-lg text-neutral-400 opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 dark:text-neutral-500"
          style={{
            background: "linear-gradient(135deg, transparent 55%, currentColor 55%)",
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, cell, latest: cell };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const delta = Math.max(e.clientX - d.x, e.clientY - d.y);
            d.latest = clampCell(d.cell + delta / PX_PER_REM_OF_CELL);
            setCell(d.latest);
          }}
          onPointerUp={() => {
            if (!drag.current) return;
            setCellSize(drag.current.latest);
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            const step = KEY_STEP[e.key];
            if (step === undefined) return;
            e.preventDefault();
            const next = clampCell(cell + step);
            setCell(next);
            setCellSize(next);
          }}
        />
      </div>
    </div>
  );
}

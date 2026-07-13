// components/Grid.tsx
"use client";
import { useRef, useState } from "react";

export type Flash = "target" | "bonus" | "invalid" | "duplicate" | null;

const FLASH_RING: Record<Exclude<Flash, null>, string> = {
  target: "ring-4 ring-emerald-400",
  bonus: "ring-4 ring-amber-400",
  invalid: "animate-shake",
  duplicate: "animate-shake",
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
  const tracing = useRef(false);

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
      <div className="h-8 text-2xl font-bold tracking-widest text-indigo-600">
        {current || " "}
      </div>
      <div
        className={`grid grid-cols-4 gap-2 rounded-2xl bg-neutral-100 p-3 select-none touch-none ${
          flash ? FLASH_RING[flash] : ""
        }`}
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
            className={`flex aspect-square w-16 items-center justify-center rounded-xl text-3xl font-bold uppercase transition-all sm:w-20 ${
              path.includes(i)
                ? "scale-105 bg-indigo-600 text-white"
                : "bg-white text-neutral-800 shadow"
            }`}
          >
            {ch}
          </div>
        ))}
      </div>
    </div>
  );
}

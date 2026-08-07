// components/WordPanel.tsx
"use client";
import { useState } from "react";

export type Find = {
  word: string;
  foundAt: number;
  name: string;
  color: string;
};

function Chip({ find }: { find: Find }) {
  return (
    <span
      title={find.name}
      className="rounded-full border-b-2 bg-white px-2 py-0.5 text-sm font-medium uppercase text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
      style={{ borderColor: find.color }}
    >
      {find.word}
    </span>
  );
}

export function WordPanel({ words, finds }: { words: string[]; finds: Find[] }) {
  const [view, setView] = useState<"order" | "length">("length");
  const found = new Map(finds.map((f) => [f.word, f]));
  const lengths = [...new Set(words.map((w) => w.length))].sort((a, b) => a - b);

  const tab = (v: "order" | "length", label: string) => (
    <button
      onClick={() => setView(v)}
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
        view === v
          ? "bg-indigo-600 text-white"
          : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold whitespace-nowrap">
          Words found {found.size} / {words.length}
        </h2>
        <div className="flex shrink-0 gap-1">
          {tab("order", "By order")}
          {tab("length", "By length")}
        </div>
      </div>

      {view === "length" ? (
        <div>
          {lengths.map((len) => {
            const ofLength = words.filter((w) => w.length === len);
            const foundOfLength = ofLength.filter((w) => found.has(w));
            return (
              <div key={len} className="mb-4">
                <div className="flex justify-between text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <span>{len}-letter</span>
                  <span>
                    {foundOfLength.length}/{ofLength.length}
                  </span>
                </div>
                <div className="mb-2 mt-1 h-1.5 rounded-sm bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-sm bg-emerald-500 transition-all"
                    style={{ width: `${(foundOfLength.length / ofLength.length) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {foundOfLength.map((w) => (
                    <Chip key={w} find={found.get(w)!} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {[...finds]
            .sort((a, b) => b.foundAt - a.foundAt)
            .map((f) => (
              <li key={f.word} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                <span className="font-medium uppercase">{f.word}</span>
                <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">{f.name}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

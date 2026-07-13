// components/WordPanel.tsx
"use client";
import { useState } from "react";

export type Find = {
  word: string;
  isTarget: boolean;
  foundAt: number;
  name: string;
  color: string;
};

function Chip({ find }: { find: Find }) {
  return (
    <span
      title={find.name}
      className="rounded-full border-b-2 bg-white px-2 py-0.5 text-sm font-medium uppercase shadow-sm"
      style={{ borderColor: find.color }}
    >
      {find.word}
    </span>
  );
}

export function WordPanel({
  targetWords,
  finds,
}: {
  targetWords: string[];
  finds: Find[];
}) {
  const [view, setView] = useState<"order" | "length">("length");
  const targetFinds = new Map(finds.filter((f) => f.isTarget).map((f) => [f.word, f]));
  const bonusFinds = finds.filter((f) => !f.isTarget);
  const lengths = [...new Set(targetWords.map((w) => w.length))].sort((a, b) => a - b);

  const tab = (v: "order" | "length", label: string) => (
    <button
      onClick={() => setView(v)}
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
        view === v ? "bg-indigo-600 text-white" : "bg-neutral-200 text-neutral-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">
          Words found {targetFinds.size} / {targetWords.length}
        </h2>
        <div className="flex gap-1">
          {tab("order", "By order")}
          {tab("length", "By length")}
        </div>
      </div>

      {view === "length" ? (
        <div>
          {lengths.map((len) => {
            const words = targetWords.filter((w) => w.length === len);
            const found = words.filter((w) => targetFinds.has(w));
            return (
              <div key={len} className="mb-4">
                <div className="flex justify-between text-xs font-semibold uppercase text-neutral-500">
                  <span>{len}-letter</span>
                  <span>
                    {found.length}/{words.length}
                  </span>
                </div>
                <div className="mb-2 mt-1 h-1.5 rounded-sm bg-neutral-200">
                  <div
                    className="h-full rounded-sm bg-emerald-500 transition-all"
                    style={{ width: `${(found.length / words.length) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {found.map((w) => (
                    <Chip key={w} find={targetFinds.get(w)!} />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase text-amber-600">
              Bonus · {bonusFinds.length} rare word{bonusFinds.length === 1 ? "" : "s"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {bonusFinds.map((f) => (
                <Chip key={f.word} find={f} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {[...finds]
            .sort((a, b) => b.foundAt - a.foundAt)
            .map((f) => (
              <li key={f.word} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                <span className="font-medium uppercase">{f.word}</span>
                {!f.isTarget && (
                  <span className="text-xs font-semibold text-amber-500">bonus</span>
                )}
                <span className="ml-auto text-xs text-neutral-400">{f.name}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

"use client";
import { Find } from "./WordPanel";

export type Player = {
  _id: string;
  name: string;
  color: string;
  lastSeenAt: number;
};

// Longer words are worth more, so a scoreboard lead means good finds, not fast ones.
const points = (word: string) => word.length;
const ONLINE_MS = 45000;

export function Scoreboard({ players, finds }: { players: Player[]; finds: Find[] }) {
  // eslint-disable-next-line react-hooks/purity -- presence cutoff intentionally reads wall-clock time each render; staleness within a render is harmless here.
  const now = Date.now();
  const rows = players
    .map((p) => {
      const mine = finds.filter((f) => f.playerId === p._id);
      return {
        ...p,
        online: now - p.lastSeenAt < ONLINE_MS,
        words: mine.length,
        score: mine.reduce((sum, f) => sum + points(f.word), 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const lead = rows[0]?.score ?? 0;

  return (
    <div className="w-full">
      <h2 className="mb-2 font-bold">Scoreboard</h2>
      <ol className="space-y-1.5">
        {rows.map((p) => (
          <li key={p._id} className={`flex items-center gap-2 ${p.online ? "" : "opacity-40"}`}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="truncate font-medium">{p.name}</span>
            <span className="ml-auto shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
              {p.words} {p.words === 1 ? "word" : "words"}
            </span>
            <span className="w-8 shrink-0 text-right font-bold tabular-nums">{p.score}</span>
          </li>
        ))}
      </ol>
      {lead > 0 && (
        <div className="mt-2 flex gap-0.5 overflow-hidden rounded-sm">
          {rows
            .filter((p) => p.score)
            .map((p) => (
              <div
                key={p._id}
                title={`${p.name}: ${p.score}`}
                className="h-1.5"
                style={{ background: p.color, flexGrow: p.score }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

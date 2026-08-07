"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Grid, Flash } from "@/components/Grid";
import { WordPanel } from "@/components/WordPanel";
import { Scoreboard } from "@/components/Scoreboard";
import { colorFor, getName, getSessionId, setName } from "@/lib/session";
import { allPaths, analyzeCells } from "@/lib/game";

// Below this share of the board found, per-tile counts would give away too much.
const COUNTS_AT = 0.4;
const HINT_MS = 4000;

function JoinGate({ onJoin }: { onJoin: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 dark:bg-black/60">
      <form
        className="w-80 rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onJoin(value.trim());
        }}
      >
        <h2 className="mb-3 text-lg font-bold">Join this board</h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          placeholder="Your name"
          className="mb-3 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <button className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white">
          Play
        </button>
      </form>
    </div>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
    >
      {copied ? "Copied!" : "Share link"}
    </button>
  );
}

export default function BoardPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId as Id<"rooms">;

  const room = useQuery(api.rooms.get, { roomId });
  const finds = useQuery(api.finds.list, { roomId }) ?? [];
  const players = useQuery(api.players.list, { roomId }) ?? [];
  const join = useMutation(api.players.join);
  const heartbeat = useMutation(api.players.heartbeat);
  const submit = useMutation(api.finds.submit);

  const [name, setNameState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [playerId, setPlayerId] = useState<Id<"players"> | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState<number[] | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only SSR hydration guard: localStorage is unreadable during SSR, so we sync it once the client mounts.
    setNameState(getName());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!name || !room) return;
    const sessionId = getSessionId();
    join({ roomId: room._id, sessionId, name, color: colorFor(sessionId) }).then(
      setPlayerId
    );
  }, [name, room, join]);

  useEffect(() => {
    if (!playerId) return;
    const t = setInterval(() => heartbeat({ playerId }), 15000);
    return () => clearInterval(t);
  }, [playerId, heartbeat]);

  const ping = (f: Flash, msg: string) => {
    setFlash(f);
    setToast(msg);
    setTimeout(() => {
      setFlash(null);
      setToast(null);
    }, 900);
  };

  const onWord = async (word: string) => {
    if (!playerId || !room) return;
    const res = await submit({ roomId: room._id, playerId, word });
    if (res.result === "found") ping("found", `${word.toUpperCase()} ✓`);
    else if (res.result === "duplicate") ping("duplicate", `Already found by ${res.by}`);
    else ping("invalid", "Not a word");
  };

  if (room === undefined || !ready) {
    return <main className="flex min-h-screen items-center justify-center">Loading…</main>;
  }
  if (room === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Board not found.
      </main>
    );
  }

  const done = finds.length === room.words.length;

  const found = new Set(finds.map((f) => f.word));
  const remaining = room.words.filter((w) => !found.has(w));
  // ponytail: re-solved every render — 16 starts x ~60 words is microseconds
  const { counts, useful } = analyzeCells(room.letters, remaining);
  const showCounts = found.size >= room.words.length * COUNTS_AT;

  const showHint = () => {
    const word = remaining[Math.floor(Math.random() * remaining.length)];
    if (!word) return;
    clearTimeout(hintTimer.current);
    setHint(allPaths(room.letters, word)[0].slice(0, 3));
    hintTimer.current = setTimeout(() => setHint(null), HINT_MS);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center gap-6 p-4 md:flex-row md:items-start md:justify-center md:pt-12">
      {!name && <JoinGate onJoin={(n) => { setName(n); setNameState(n); }} />}

      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full items-center justify-end gap-4">
          <div className="flex shrink-0 gap-2">
            <button
              onClick={showHint}
              disabled={!remaining.length}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Hint
            </button>
            <ShareButton />
          </div>
        </div>

        <div className="relative">
          <Grid
            letters={room.letters}
            flash={flash}
            onWord={onWord}
            hint={hint}
            counts={showCounts ? counts : null}
            useful={useful}
          />
          {toast && (
            <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-white dark:bg-white dark:text-neutral-900">
              {toast}
            </div>
          )}
        </div>

        {done && (
          <div className="rounded-xl bg-emerald-100 px-4 py-2 text-center font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            🎉 All {room.words.length} words found!
          </div>
        )}
      </div>

      <div className="flex w-full max-w-md flex-col gap-6">
        <Scoreboard players={players} finds={finds} />
        <WordPanel words={room.words} finds={finds} />
      </div>
    </main>
  );
}

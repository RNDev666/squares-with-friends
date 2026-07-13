"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Grid, Flash } from "@/components/Grid";
import { WordPanel } from "@/components/WordPanel";
import { colorFor, getName, getSessionId, setName } from "@/lib/session";

function JoinGate({ onJoin }: { onJoin: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
      <form
        className="w-80 rounded-2xl bg-white p-6 shadow-xl"
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
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2"
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

  useEffect(() => {
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
    if (res.result === "target") ping("target", `${word.toUpperCase()} ✓`);
    else if (res.result === "bonus") ping("bonus", `${word.toUpperCase()} — bonus!`);
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

  const online = players.filter((p) => Date.now() - p.lastSeenAt < 45000);
  const done =
    finds.filter((f) => f.isTarget).length === room.targetWords.length;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center gap-6 p-4 md:flex-row md:items-start md:justify-center md:pt-12">
      {!name && <JoinGate onJoin={(n) => { setName(n); setNameState(n); }} />}

      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {online.map((p) => (
              <span
                key={p._id}
                className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                style={{ background: p.color }}
              >
                {p.name}
              </span>
            ))}
          </div>
          <ShareButton />
        </div>

        <div className="relative">
          <Grid letters={room.letters} flash={flash} onWord={onWord} />
          {toast && (
            <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white">
              {toast}
            </div>
          )}
        </div>

        {done && (
          <div className="rounded-xl bg-emerald-100 px-4 py-2 text-center font-semibold text-emerald-800">
            🎉 All {room.targetWords.length} words found! Bonus hunting continues.
          </div>
        )}
      </div>

      <WordPanel targetWords={room.targetWords} finds={finds} />
    </main>
  );
}

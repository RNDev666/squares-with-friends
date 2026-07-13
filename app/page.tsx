"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { generateBoard, loadWordLists } from "@/lib/game";

export default function Home() {
  const router = useRouter();
  const createRoom = useMutation(api.rooms.create);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { common, full } = await loadWordLists();
      const board = generateBoard(common, full);
      const roomId = await createRoom(board);
      router.push(`/board/${roomId}`);
    } catch (err) {
      console.error(err);
      setError("Couldn't create a board — try again.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-5xl font-extrabold tracking-tight">
        Squares <span className="text-indigo-600">With Friends</span>
      </h1>
      <p className="max-w-md text-lg text-neutral-500">
        A 4×4 word hunt you solve together. Create a board, share the link, and
        find every word as a team.
      </p>
      <button
        onClick={create}
        disabled={busy}
        className="rounded-xl bg-indigo-600 px-8 py-4 text-xl font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? "Generating board…" : "Create a board"}
      </button>
      {error && <p className="text-rose-600">{error}</p>}
    </main>
  );
}

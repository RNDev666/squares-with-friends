# Squares With Friends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Co-op multiplayer clone of squares.org — a 4×4 swipe-to-spell word game where a shared link lets friends find all the words on one board together in real time.

**Architecture:** Next.js (App Router) frontend with a Convex backend for storage + realtime reactivity. Boards are generated and solved client-side in the host's browser (Boggle dice → trie DFS against a dictionary), then stored in Convex; all gameplay mutations validate against the stored solution server-side. No accounts — localStorage session ID + display name.

**Tech Stack:** Next.js 15+ (TypeScript, App Router), Tailwind CSS, Convex. No other runtime dependencies.

## Global Constraints

- TypeScript strict mode (create-next-app default) — no `any`, no `@ts-ignore`.
- **No automated tests** — explicit user decision. Verification is manual per task.
- No new npm dependencies beyond `convex` and what create-next-app installs.
- All word logic is lowercase internally; UI displays uppercase.
- Minimum word length 4; grid is 4×4; adjacency is 8-directional, no cell reuse.
- Spec: `docs/superpowers/specs/2026-07-13-squares-coop-design.md`.
- Commit after every task.

---

### Task 1: Scaffold Next.js + Convex

**Files:**
- Create: entire Next.js scaffold at repo root (`app/`, `package.json`, etc.)
- Create: `convex/` folder + `.env.local` (via `npx convex dev`)

**Interfaces:**
- Consumes: nothing
- Produces: working `npm run dev`, `NEXT_PUBLIC_CONVEX_URL` in `.env.local`, `convex/_generated/` for later tasks

- [ ] **Step 1: Scaffold Next.js into the repo root**

The repo already contains `docs/` and `.git`. create-next-app rejects unknown files, so move `docs/` aside first:

```bash
mv docs /tmp/docs-stash
npx create-next-app@latest . --yes --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
mv /tmp/docs-stash docs
```

- [ ] **Step 2: Install and provision Convex**

```bash
npm install convex
npx convex dev --once
```

`npx convex dev --once` is interactive on first run (device login + project creation) and writes `.env.local` with `NEXT_PUBLIC_CONVEX_URL` plus an empty `convex/` folder. **If this shell can't run interactive auth, ask the user to run `npx convex dev` once in their terminal, then continue.**

- [ ] **Step 3: Verify dev server boots**

Run: `npm run dev` — expect the Next.js starter page at localhost:3000 with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Convex"
```

---

### Task 2: Word list assets

**Files:**
- Create: `scripts/fetch-words.mjs`
- Create (generated): `public/words/full.txt`, `public/words/common.txt`

**Interfaces:**
- Consumes: nothing
- Produces: `public/words/full.txt` (all valid words, one per line, lowercase, `[a-z]{4,16}`) and `public/words/common.txt` (target-eligible subset). Consumed by `loadWordLists()` in Task 3.

- [ ] **Step 1: Write the fetch script**

```js
// scripts/fetch-words.mjs — one-off: downloads + trims word lists into public/words/
import { writeFileSync, mkdirSync } from "node:fs";

const get = async (url) => (await fetch(url)).text();
const ok = (w) => /^[a-z]{4,16}$/.test(w);

const enable = (
  await get("https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt")
)
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter(ok);

const commonRaw = (
  await get(
    "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt"
  )
)
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase());

const full = new Set(enable);
const common = commonRaw.filter((w) => ok(w) && full.has(w));

mkdirSync("public/words", { recursive: true });
writeFileSync("public/words/full.txt", [...full].join("\n"));
writeFileSync("public/words/common.txt", common.join("\n"));
console.log(`full: ${full.size} words, common: ${common.length} words`);
```

- [ ] **Step 2: Run it and sanity-check output**

Run: `node scripts/fetch-words.mjs`
Expected: `full: ~170000 words, common: ~6000-8000 words`. Spot-check: `common.txt` contains everyday words only; `full.txt` is a superset.

- [ ] **Step 3: Commit (assets included — they're static inputs, not build artifacts)**

```bash
git add scripts/fetch-words.mjs public/words
git commit -m "feat: add dictionary assets (ENABLE + common-words subset)"
```

---

### Task 3: Game core (`lib/game.ts`)

**Files:**
- Create: `lib/game.ts`

**Interfaces:**
- Consumes: `public/words/*.txt` via fetch (Task 2)
- Produces (used by Tasks 6, 7, 8):
  - `type Board = { letters: string[]; targetWords: string[]; bonusWords: string[] }`
  - `loadWordLists(): Promise<{ common: Set<string>; full: Set<string> }>`
  - `generateBoard(common: Set<string>, full: Set<string>): Board`

- [ ] **Step 1: Write the module**

```ts
// lib/game.ts — pure game logic: board generation + Boggle solving.

// ponytail: classic Boggle dice with the Q face swapped for P — avoids all "Qu" tile logic
const DICE = [
  "AAEEGN", "ABBJOO", "ACHOPS", "AFFKPS", "AOTTOW", "CIMOTU", "DEILRX", "DELRVY",
  "DISTTY", "EEGHNW", "EEINSU", "EHRTVW", "EIOSST", "ELRTTY", "HIMNPU", "HLNNRZ",
];

// 8-directional neighbors for each cell of the 4x4 grid, precomputed.
const NEIGHBORS: number[][] = Array.from({ length: 16 }, (_, i) => {
  const r = Math.floor(i / 4), c = i % 4;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if ((dr || dc) && nr >= 0 && nr < 4 && nc >= 0 && nc < 4) out.push(nr * 4 + nc);
    }
  return out;
});

type Trie = { end: boolean; kids: Map<string, Trie> };

function buildTrie(words: Iterable<string>): Trie {
  const root: Trie = { end: false, kids: new Map() };
  for (const w of words) {
    let n = root;
    for (const ch of w) {
      let k = n.kids.get(ch);
      if (!k) {
        k = { end: false, kids: new Map() };
        n.kids.set(ch, k);
      }
      n = k;
    }
    n.end = true;
  }
  return root;
}

function solve(letters: string[], trie: Trie): Set<string> {
  const found = new Set<string>();
  const used = new Array<boolean>(16).fill(false);
  const dfs = (i: number, node: Trie, word: string) => {
    const next = node.kids.get(letters[i]);
    if (!next) return;
    const w = word + letters[i];
    used[i] = true;
    if (next.end && w.length >= 4) found.add(w);
    for (const n of NEIGHBORS[i]) if (!used[n]) dfs(n, next, w);
    used[i] = false;
  };
  for (let i = 0; i < 16; i++) dfs(i, trie, "");
  return found;
}

function rollLetters(): string[] {
  const dice = [...DICE].sort(() => Math.random() - 0.5);
  return dice.map((d) => d[Math.floor(Math.random() * 6)].toLowerCase());
}

export type Board = { letters: string[]; targetWords: string[]; bonusWords: string[] };

export function generateBoard(common: Set<string>, full: Set<string>): Board {
  const trie = buildTrie(full);
  for (let attempt = 0; attempt < 200; attempt++) {
    const letters = rollLetters();
    const words = [...solve(letters, trie)];
    const targetWords = words.filter((w) => common.has(w)).sort();
    if (targetWords.length >= 15 && targetWords.length <= 45) {
      return { letters, targetWords, bonusWords: words.filter((w) => !common.has(w)).sort() };
    }
  }
  throw new Error("Could not generate a board with a good word count");
}

export async function loadWordLists(): Promise<{ common: Set<string>; full: Set<string> }> {
  const [c, f] = await Promise.all([
    fetch("/words/common.txt").then((r) => r.text()),
    fetch("/words/full.txt").then((r) => r.text()),
  ]);
  return {
    common: new Set(c.split("\n").filter(Boolean)),
    full: new Set(f.split("\n").filter(Boolean)),
  };
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. (Behavior is verified live in Task 6 when the create flow runs it.)

- [ ] **Step 3: Commit**

```bash
git add lib/game.ts
git commit -m "feat: board generation and Boggle solver"
```

---

### Task 4: Convex backend

**Files:**
- Create: `convex/schema.ts`, `convex/rooms.ts`, `convex/players.ts`, `convex/finds.ts`

**Interfaces:**
- Consumes: nothing (Convex generates `convex/_generated/*`)
- Produces (used by Tasks 6, 8 via `api.*`):
  - `api.rooms.create({ letters, targetWords, bonusWords }) → Id<"rooms">`
  - `api.rooms.get({ roomId }) → room doc | null`
  - `api.players.join({ roomId, sessionId, name, color }) → Id<"players">`
  - `api.players.heartbeat({ playerId }) → void`
  - `api.players.list({ roomId }) → player docs`
  - `api.finds.submit({ roomId, playerId, word }) → { result: "target" | "bonus" | "invalid" } | { result: "duplicate"; by: string }`
  - `api.finds.list({ roomId }) → { word, isTarget, foundAt, name, color }[]`

- [ ] **Step 1: Write the schema**

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    letters: v.array(v.string()),
    targetWords: v.array(v.string()),
    bonusWords: v.array(v.string()),
  }),
  players: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.string(),
    color: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_session", ["roomId", "sessionId"]),
  finds: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    word: v.string(),
    isTarget: v.boolean(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_word", ["roomId", "word"]),
});
```

(No `createdAt`/`foundAt` fields — Convex's built-in `_creationTime` covers both.)

- [ ] **Step 2: Write rooms functions**

```ts
// convex/rooms.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    letters: v.array(v.string()),
    targetWords: v.array(v.string()),
    bonusWords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.letters.length !== 16) throw new Error("Board must have 16 letters");
    return await ctx.db.insert("rooms", args);
  },
});

// ponytail: returns the full solution to every client — fine for a co-op game with no stakes
export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => ctx.db.get(roomId),
});
```

- [ ] **Step 3: Write players functions**

```ts
// convex/players.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, lastSeenAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("players", { ...args, lastSeenAt: Date.now() });
  },
});

export const heartbeat = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, { playerId }) => {
    await ctx.db.patch(playerId, { lastSeenAt: Date.now() });
  },
});

export const list = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) =>
    ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect(),
});
```

- [ ] **Step 4: Write finds functions**

```ts
// convex/finds.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submit = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    word: v.string(),
  },
  handler: async (ctx, args) => {
    const word = args.word.toLowerCase();
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const isTarget = room.targetWords.includes(word);
    if (!isTarget && !room.bonusWords.includes(word)) {
      return { result: "invalid" as const };
    }

    const dupe = await ctx.db
      .query("finds")
      .withIndex("by_room_word", (q) => q.eq("roomId", args.roomId).eq("word", word))
      .unique();
    if (dupe) {
      const finder = await ctx.db.get(dupe.playerId);
      return { result: "duplicate" as const, by: finder?.name ?? "someone" };
    }

    await ctx.db.insert("finds", {
      roomId: args.roomId,
      playerId: args.playerId,
      word,
      isTarget,
    });
    return { result: isTarget ? ("target" as const) : ("bonus" as const) };
  },
});

export const list = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const finds = await ctx.db
      .query("finds")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const cache = new Map<string, { name: string; color: string }>();
    const out = [];
    for (const f of finds) {
      if (!cache.has(f.playerId)) {
        const p = await ctx.db.get(f.playerId);
        cache.set(f.playerId, { name: p?.name ?? "?", color: p?.color ?? "#888" });
      }
      const { name, color } = cache.get(f.playerId)!;
      out.push({ word: f.word, isTarget: f.isTarget, foundAt: f._creationTime, name, color });
    }
    return out;
  },
});
```

- [ ] **Step 5: Verify the deployment accepts it**

Run: `npx convex dev --once`
Expected: schema + functions push with no errors; `convex/_generated/api.d.ts` now includes `rooms`, `players`, `finds`.

- [ ] **Step 6: Commit**

```bash
git add convex
git commit -m "feat: Convex schema and room/player/find functions"
```

---

### Task 5: Convex provider, session identity, layout

**Files:**
- Create: `app/ConvexClientProvider.tsx`, `lib/session.ts`
- Modify: `app/layout.tsx` (wrap children, set metadata), `app/globals.css` (add shake animation)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_CONVEX_URL` (Task 1)
- Produces (used by Tasks 6, 8):
  - `getSessionId(): string`, `getName(): string | null`, `setName(name: string): void`, `colorFor(sessionId: string): string`
  - `.animate-shake` CSS class

- [ ] **Step 1: Write the provider**

```tsx
// app/ConvexClientProvider.tsx
"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

- [ ] **Step 2: Wire it into the layout**

Modify `app/layout.tsx`: import `ConvexClientProvider`, wrap `{children}` with it inside `<body>`, and set metadata:

```tsx
export const metadata: Metadata = {
  title: "Squares With Friends",
  description: "Find all the words together — co-op word puzzles you can share with a link.",
};
```

Keep the font setup create-next-app generated.

- [ ] **Step 3: Write the session module**

```ts
// lib/session.ts — anonymous identity: localStorage session + name, deterministic color.
const PALETTE = [
  "#e11d48", "#2563eb", "#16a34a", "#d97706",
  "#9333ea", "#0d9488", "#db2777", "#65a30d",
];

export function getSessionId(): string {
  let id = localStorage.getItem("sq_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sq_session", id);
  }
  return id;
}

export function getName(): string | null {
  return localStorage.getItem("sq_name");
}

export function setName(name: string) {
  localStorage.setItem("sq_name", name);
}

// ponytail: hash-picked color, collisions possible — names disambiguate
export function colorFor(sessionId: string): string {
  let h = 0;
  for (const ch of sessionId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
```

- [ ] **Step 4: Add the shake animation to `app/globals.css`**

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
.animate-shake { animation: shake 0.3s; }
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint` — expect no errors.

- [ ] **Step 6: Commit**

```bash
git add app lib/session.ts
git commit -m "feat: Convex provider, session identity, app shell"
```

---

### Task 6: Landing page with create-board flow

**Files:**
- Modify: `app/page.tsx` (replace starter content entirely)

**Interfaces:**
- Consumes: `loadWordLists`, `generateBoard` (Task 3); `api.rooms.create` (Task 4)
- Produces: redirect to `/board/{roomId}` (Task 8's route)

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
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
    } catch {
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
```

- [ ] **Step 2: Verify live**

Run `npm run dev` (and `npx convex dev` in another shell). Open localhost:3000, click **Create a board**. Expected: brief generating state, then redirect to `/board/<id>` (404 page for now — route comes in Task 8). Confirm in the Convex dashboard (or `npx convex data rooms`) that a room doc exists with 16 letters and 15–45 targetWords.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: landing page with board creation"
```

---

### Task 7: Grid component (swipe tracing)

**Files:**
- Create: `components/Grid.tsx`

**Interfaces:**
- Consumes: `.animate-shake` (Task 5)
- Produces (used by Task 8):
  - `type Flash = "target" | "bonus" | "invalid" | "duplicate" | null`
  - `<Grid letters={string[]} flash={Flash} onWord={(word: string) => void} />`

- [ ] **Step 1: Write the component**

```tsx
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
        {current || " "}
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
```

Skipped: SVG trace lines between cells (cell highlight + word preview is enough; add if the trace feels unclear in play).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint` — no errors. (Interactive feel is verified in Task 8/9 once the board page renders it.)

- [ ] **Step 3: Commit**

```bash
git add components/Grid.tsx
git commit -m "feat: swipe-tracing grid component"
```

---

### Task 8: Board page + word panel (the co-op screen)

**Files:**
- Create: `components/WordPanel.tsx`, `app/board/[roomId]/page.tsx`

**Interfaces:**
- Consumes: `Grid`/`Flash` (Task 7), session helpers (Task 5), `api.rooms.get`, `api.players.*`, `api.finds.*` (Task 4)
- Produces: the complete playable route `/board/{roomId}`

- [ ] **Step 1: Write the word panel**

```tsx
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
              Bonus · {bonusFinds.length} rare words
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
```

- [ ] **Step 2: Write the board page**

```tsx
// app/board/[roomId]/page.tsx
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
```

- [ ] **Step 3: Verify the full co-op loop live**

With `npm run dev` + `npx convex dev` running:
1. Create a board from the landing page → join gate appears → enter a name → grid renders.
2. Swipe a target word (pick one visible in Convex dashboard's room doc) → green flash, word appears in panel with your color chip.
3. Open the same URL in a second browser window (or incognito) → join as a different name → both names show in the presence row; a word found in one window appears in the other within ~1s.
4. Re-submit the same word from window 2 → "Already found by …" toast.
5. Swipe gibberish → shake + "Not a word".

- [ ] **Step 4: Commit**

```bash
git add components/WordPanel.tsx app/board
git commit -m "feat: co-op board page with live finds, presence, and word panel"
```

---

### Task 9: Lint, build, end-to-end pass

**Files:**
- Modify: anything lint/build flags

- [ ] **Step 1: Full static check**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: all clean. Fix anything flagged.

- [ ] **Step 2: Mobile check**

In browser devtools (or the Browser pane resized to mobile, 375×812): grid fits, swipe works with touch events, panel stacks below grid, join gate usable.

- [ ] **Step 3: Play a full board**

Find all target words on a fresh board (use the room doc's targetWords list to cheat) → completion banner appears; bonus submissions still register afterward.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: lint/build fixes and polish"
```

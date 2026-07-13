# Squares With Friends — Design

Co-op multiplayer clone of squares.org (the daily word game): a 4×4 letter grid
where players swipe through adjacent letters to find hidden words. The twist:
boards are shareable via link, and everyone on the board finds words together
in real time.

## User flow

1. Landing page → "Create board" → app generates a puzzle → redirect to `/board/{roomId}`.
2. Host copies the link and sends it to friends.
3. Anyone opening the link types a display name and joins instantly (no accounts).
4. All players see the same grid; any word found by anyone appears immediately
   for everyone, attributed to the finder (name + color).
5. Board is complete when all target words are found (celebration); bonus words
   keep counting past completion.

## Game mechanics (cloned from squares.org)

- 4×4 letter grid; trace a path through adjacent cells (8-directional), no cell
  reuse within a word. Touch swipe and mouse drag both supported.
- Minimum word length: 4.
- **Target words**: findable words that appear in a common-words list, grouped
  by length with per-length progress (e.g. `4-LETTER 3/18`).
- **Bonus words**: valid dictionary words too rare for the target list;
  separate running counter.
- Found-words list has two views: by order found / by length.
- No winners, no scoring competition, no money — pure co-op.

## Architecture

- **Next.js** (App Router, TypeScript) + **Tailwind**, deployed on Vercel.
- **Convex** for data + realtime. Clients subscribe to room queries and update
  reactively; no socket code.
- **Identity**: `localStorage` session ID + display name + assigned color.
  Rejoining the same room from the same browser restores identity. No admin
  role — nothing to administer.
- **Dictionary**: two static word-list assets (SCOWL/ENABLE-derived, public
  domain): `common` (target-eligible) and `full` (all valid words). Loaded
  lazily in the host's browser only at board-generation time.

## Board generation (client-side)

- Random grid using classic Boggle dice distribution for letter quality.
- Solve with trie + DFS (trivial at 4×4). Split solutions: in `common` list →
  target words; rest → bonus words.
- Regenerate until the board yields ~15–45 target words.
- Store letters + both solved word lists in the room document at creation.

## Convex schema

- `rooms`: letters (16 chars), targetWords, bonusWords, createdAt
- `players`: roomId, sessionId, name, color, lastSeenAt (drives presence list)
- `finds`: roomId, word, playerId, foundAt

`submitWord` mutation validates the word against the room's stored solution
lists server-side (clients can't inject arbitrary words) and enforces
uniqueness — first finder wins attribution; duplicates no-op with an
"already found by X" response.

## UI

Mobile-first. Grid front and center with smooth pointer tracing, current path
highlighted, submit feedback: green flash (target), gold flash (bonus), shake
(invalid/duplicate). Panel below/beside: per-length progress bars, found-words
list with player color chips, presence row, share-link button. Distinct visual
identity — not a pixel copy of squares.org.

## Out of scope (YAGNI)

Accounts, daily shared board, competitive scoring, payments, live swipe
traces, spectator mode, board history, automated tests (per user decision).

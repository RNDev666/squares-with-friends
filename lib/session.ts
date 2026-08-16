// lib/session.ts — anonymous identity: localStorage session + name, deterministic color.
export const PALETTE = [
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

// Tile edge length in rem; clamped to the slider's range on read.
export const CELL_MIN = 3;
export const CELL_MAX = 12;
export const CELL_DEFAULT = 7;

export function getCellSize(): number {
  const v = Number(localStorage.getItem("sq_cell"));
  return v >= CELL_MIN && v <= CELL_MAX ? v : CELL_DEFAULT;
}

export function setCellSize(rem: number) {
  localStorage.setItem("sq_cell", String(rem));
}

// ponytail: hash-picked color, collisions possible — names disambiguate
export function colorFor(sessionId: string): string {
  let h = 0;
  for (const ch of sessionId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

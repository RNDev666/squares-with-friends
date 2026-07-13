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

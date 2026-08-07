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

export type Board = { letters: string[]; words: string[] };

// Boards outside this range are re-rolled: too few words is a dull hunt, too
// many never gets finished. Against the full lexicon the median board has 53
// words, so ~62% of rolls land inside and the 200 attempts below are ample.
const MIN_WORDS = 30;
const MAX_WORDS = 90;

export function generateBoard(dictionary: Set<string>): Board {
  const trie = buildTrie(dictionary);
  for (let attempt = 0; attempt < 200; attempt++) {
    const letters = rollLetters();
    const words = [...solve(letters, trie)].sort();
    if (words.length >= MIN_WORDS && words.length <= MAX_WORDS) {
      return { letters, words };
    }
  }
  throw new Error("Could not generate a board with a good word count");
}

// Every board path that spells `word`.
export function allPaths(letters: string[], word: string): number[][] {
  const out: number[][] = [];
  const path: number[] = [];
  const dfs = (i: number, d: number) => {
    if (letters[i] !== word[d]) return;
    path.push(i);
    if (d === word.length - 1) out.push([...path]);
    else for (const n of NEIGHBORS[i]) if (!path.includes(n)) dfs(n, d + 1);
    path.pop();
  };
  for (let i = 0; i < 16; i++) dfs(i, 0);
  return out;
}

// Per cell: how many of `words` can start there, and whether the cell appears
// anywhere in any of them. A word spellable from two identical letters counts
// once for each of those starting cells.
export function analyzeCells(letters: string[], words: string[]) {
  const counts = new Array<number>(16).fill(0);
  const useful = new Array<boolean>(16).fill(false);
  for (const w of words) {
    const starts = new Set<number>();
    for (const p of allPaths(letters, w)) {
      starts.add(p[0]);
      for (const i of p) useful[i] = true;
    }
    for (const s of starts) counts[s]++;
  }
  return { counts, useful };
}

// The ENABLE Scrabble lexicon — see scripts/fetch-words.mjs.
export async function loadDictionary(): Promise<Set<string>> {
  const text = await fetch("/words.txt").then((r) => r.text());
  return new Set(text.split(/\r?\n/).filter(Boolean));
}

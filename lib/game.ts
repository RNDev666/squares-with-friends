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

// scripts/fetch-words.mjs — one-off: builds the game's word list into public/words/
// Familiar words (google-10000) filtered to real spellings (ENABLE). Swap the
// intersection below for `enable` alone to play with the full dictionary.
import { writeFileSync, mkdirSync } from "node:fs";

const get = async (url) => (await fetch(url)).text();
const ok = (w) => /^[a-z]{4,16}$/.test(w);

const enable = (
  await get("https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt")
)
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter(ok);

const spellings = new Set(enable);

const common = (
  await get(
    "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt"
  )
)
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter((w) => ok(w) && spellings.has(w));

mkdirSync("public/words", { recursive: true });
writeFileSync("public/words/common.txt", common.join("\n"));
console.log(`common: ${common.length} words`);

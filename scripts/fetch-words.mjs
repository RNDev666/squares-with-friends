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

const full = new Set(enable);

mkdirSync("public/words", { recursive: true });
writeFileSync("public/words/full.txt", [...full].join("\n"));
console.log(`full: ${full.size} words`);

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

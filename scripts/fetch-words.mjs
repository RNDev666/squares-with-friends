// scripts/fetch-words.mjs — one-off: builds the game's word list into public/words.txt
//
// The list is the intersection of two sources:
//   ENABLE      — real spellings, but includes dictionary junk (elhi, okeh, hisn)
//   count_1w    — 333k words ranked by frequency, but includes misspellings
// Taking frequency-ranked words that ENABLE also knows gives real words people
// actually recognise. RANK_CUTOFF is where to stop down that ranking.
//
// 30k was chosen by probing: every ordinary word tested (moth, toes, twig,
// broom, otter...) is in, no junk is, and boards land at a median of 27 words.
// Below ~20k ordinary words start falling out; past ~40k junk starts leaking in
// (mibs, fino, vara) and past 70k so does outright noise (okeh, hent, sware).
const RANK_CUTOFF = 30000;

import { writeFileSync } from "node:fs";

const get = async (url) => (await fetch(url)).text();
const ok = (w) => /^[a-z]{4,16}$/.test(w);

const [enableRaw, frequencyRaw] = await Promise.all([
  get("https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt"),
  get("https://norvig.com/ngrams/count_1w.txt"),
]);

const spellings = new Set(
  enableRaw.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(ok)
);

const words = frequencyRaw
  .split(/\r?\n/)
  .map((line) => line.split("\t")[0])
  .filter((w) => w && ok(w) && spellings.has(w))
  .slice(0, RANK_CUTOFF);

writeFileSync("public/words.txt", words.join("\n"));
console.log(`${words.length} words (top ${RANK_CUTOFF} by frequency, ∩ ENABLE)`);

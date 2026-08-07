// scripts/fetch-words.mjs — one-off: builds the game's word list into public/words.txt
//
// ENABLE: the public-domain word list North American Scrabble lexicons are
// built from. Standard for word games, so anything a player challenges is
// settled by "it's in the Scrabble dictionary". It does carry the long tail
// (elhi, okeh, hisn) — that tail is the point, not a defect.
import { writeFileSync } from "node:fs";

const ok = (w) => /^[a-z]{4,16}$/.test(w); // the game never scores under 4

const enable = await (
  await fetch("https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt")
).text();

const words = [
  ...new Set(enable.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(ok)),
];

writeFileSync("public/words.txt", words.join("\n"));
console.log(`${words.length} words (ENABLE, 4-16 letters)`);

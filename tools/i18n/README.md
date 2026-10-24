# Tamil words for the CRM

The CRM is written in English. When someone picks தமிழ், `src/lib/i18n.js` swaps the words on screen using `src/lib/ta-dict.js`.

- `todo-exact.json` / `todo-pats.json`: the English text, in order. `ta-*.tsv` / `ta-pats.tsv`: the Tamil for each line number (`-` means leave in English).
- `node tools/i18n/build.cjs` rebuilds `src/lib/ta-dict.js`.
- New screens: `node tools/i18n/extract.cjs /tmp/strings.json` lists every English string in the code; add the missing ones to a new `ta-7.tsv` (and to `todo-exact.json`), then rebuild.

Anything not in the list simply stays in English, so nothing breaks.

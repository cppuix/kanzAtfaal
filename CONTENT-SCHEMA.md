# Content JSON Schema

This document describes the shape of the content files that power the app and how to add a
new language, book, or question set. No build step is involved — JSON files are fetched at
runtime by `src/services/content.js`.

---

## The content files

| File                  | `meta.id`      | Language | Direction | Items | Audio |
|-----------------------|----------------|----------|-----------|-------|-------|
| `content.ar.json`     | `muntaqaa-ar`  | Arabic   | rtl       | 308   | yes   |
| `content.kanz-ar.json`| `kanz-ar`      | Arabic   | rtl       | 1536  | no    |
| `content.kanz-en.json`| `kanz-en`      | English  | ltr       | 1536  | no    |

> The repository previously contained a `content.en.json` **legacy empty stub** (`items: []`,
> same `id` as `kanz-en`, never loaded). It has been removed.

---

## How the app consumes a content file

1. `src/services/content.js` → `CONTENT_FILES` lists every selectable file. **Add your file here**
   or it won't appear in the language/content switcher.
2. `getContent(path)` fetches + parses the JSON once and keeps it in an in-memory cache
   (`contentCache`), so switching between content is instant after the first load.
3. `loadContent(path)` hands the data to the store via `store.setContentData(cfg, qaData, sections, path)`.
4. The **sections** list is derived automatically: `[...new Set(items.map(q => q.section))]` —
   i.e. unique `section` strings in **order of first appearance**. That order drives the drawer
   chapter list and the quiz chapter dropdown.
5. The service worker caches content files in the app shell — **add your file to `SHELL_ASSETS`
   in `sw.js`** so it works offline (and bump `CACHE_NAME` for existing installs).

### Steps to add a new content file

1. Create `content.<something>.json` following the schema below.
2. Register it in `CONTENT_FILES` in `src/services/content.js` (label shown in the switcher).
3. Add it to `SHELL_ASSETS` in `sw.js` and bump `CACHE_NAME`.
4. Serve the app (static server), open the content switcher, and test: browse, search, quiz,
   favorites, direction/language flip, about page.

---

## Top-level structure

```json
{
  "meta":   { "...": "see below" },
  "ui":     { "...": "all interface strings" },
  "about":  { "...": "optional — About modal content" },
  "items":  [ { "...": "question/answer records" } ]
}
```

A minimal, valid file:

```json
{
  "meta": {
    "id": "my-book",
    "lang": "ar",
    "dir": "rtl",
    "fonts": ["Amiri", "Tajawal"],
    "audio": false,
    "numerals": "arabic",
    "buildMinWords": 4,
    "blankMinWords": 3,
    "stopWords": ["من", "في", "على"]
  },
  "ui": {
    "appTitle": "كتابي",
    "allSections": "جميع الأسئلة",
    "counterSuffix": "سؤال",
    "startQuiz": "ابدأ الاختبار"
  },
  "items": [
    { "id": 1, "q": "من ربك؟", "a": "ربي الله.", "section": "باب الإيمان" }
  ]
}
```

---

## `meta` — document metadata

| Field            | Type     | Required | Description |
|------------------|----------|----------|-------------|
| `id`             | string   | **yes**  | Unique, stable identifier. Prefixes all `localStorage` keys (favorites, quiz history, saved content), so changing it orphans saved user data. |
| `lang`           | string   | **yes**  | BCP-47 language tag, e.g. `"ar"`, `"en"`. Applied to `<html lang="...">`. |
| `dir`            | string   | **yes**  | `"rtl"` or `"ltr"`. Applied to `<html dir="...">`; the whole layout flips via logical CSS properties. |
| `fonts`          | string[] | no       | Suggested font stack. **Informational only** — the CSS hardcodes `Amiri`/`Tajawal` for Arabic; it is not applied at runtime. |
| `audio`          | boolean  | **yes**  | `true` shows the play button on cards and enables the *Listen* quiz mode. |
| `audioPath`      | string   | if audio | Template for audio files, `{id}` is replaced with the item's `id`, e.g. `"audios/{id}.opus"`. Files live in `audios/`. |
| `numerals`       | string   | no       | `"arabic"` (٠١٢٣) or `"western"` (0123). Drives `store.toArabic()`. Defaults to western if omitted. |
| `buildMinWords`  | number   | no       | Minimum number of words in the answer for it to be eligible for *Build-the-Answer* quiz mode. |
| `blankMinWords`  | number   | no       | Minimum number of words in the answer for it to be eligible for *Fill-in-the-Blank* quiz mode. |
| `stopWords`      | string[] | no       | Words ignored when choosing the hidden "key word" for *Build* / *Blank* quiz modes (e.g. `"من"`, `"في"`). |

---

## `ui` — interface strings

Every key has an app-side fallback, so a minimal file can omit most of them. The complete set
used by the app is grouped below; values may contain the `{n}` placeholder (replaced with a
number) and plain text only (no HTML).

**App / titles**
- `appTitle` — app name in the top bar, `<title>`, and share sheet.

**Browse / search**
- `searchPlaceholder`, `allSections` ("جميع الأسئلة"), `allSectionsShort` ("الكل"),
  `scopeAll` / `scopeQ` / `scopeA` (search-scope buttons), `counterSuffix` ("سؤال"),
  `questionNum` (`"س {n}"`).

**Navigation**
- `browseNav`, `favsNav`, `quizNav`, `aboutBtn`.

**Cards**
- `showAnswer` (aria-label on the reveal button), `answerLabel` ("الجواب"), `close`,
  `listen`, `save`, `saved`, `unsaved`, `copyText`, `shareImage`.

**Favorites view**
- `favoritesTitle`, `noFavsTitle`, `noFavsHint`.

**Quiz setup**
- `quizHeader`, `quizSubHeader`, `allChapters`, `questionCount`, `quizType`,
  `modeMCQ`, `modeBuild`, `modeBlank`, `modeListen`, `startQuiz`, `weakSpotsLabel`
  (`"نقاط الضعف ({n} سؤال) ⚠"`).

**Quiz gameplay**
- `score`, `placeTilesHint`, `checkAnswer`, `correctFeedback`, `wrongOrderFeedback`,
  `correctBlankFeedback`, `wrongBlankFeedback`, `correctListenFeedback`,
  `wrongListenFeedback`, `correctMCQFeedback`, `wrongMCQFeedback`,
  `notEnoughQuestions`, `next`, `retry`, `replay`, `audioError`.

**Results**
- `resultPerfect` / `resultPerfectMsg`, `resultGreat` / `resultGreatMsg`,
  `resultGood` / `resultGoodMsg`, `resultTryAgain` / `resultTryAgainMsg`.

**Settings**
- `settingsTitle`, `fontSizeLabel`, `contrastLabel`, `shareAppUrl`.

> `weakSpots` (without `Label`) exists in the bundled files but is not referenced by the app;
> keep it only for compatibility.

---

## `about` — About modal (optional)

```json
"about": {
  "title": "منتقى كنز الأطفال",
  "body": [ "First paragraph.", "Second paragraph." ],
  "contactTitle": "للتواصل",
  "contacts": [
    { "label": "البريد الإلكتروني", "value": "user@example.com", "href": "mailto:user@example.com" }
  ]
}
```

| Field          | Type       | Required | Description |
|----------------|------------|----------|-------------|
| `title`        | string     | yes      | Heading shown at the top of the About modal. |
| `body`         | string[]   | yes      | Paragraphs, each rendered as its own `<p>`. Text is HTML-escaped, then a small allow-list of inline tags is restored: `<strong>`, `<em>`, `<br>`. Everything else is shown as literal text. |
| `contactTitle` | string     | no       | Optional heading above the contact links. |
| `contacts`     | object[]   | no       | Optional list of `{ label, value, href }`; rendered as link rows. `href` is escaped. |

> `about.body` may use the inline tags above (`<strong>`, `<em>`, `<br>`) for emphasis; any
> other markup is escaped and shown as literal text.

---

## `items` — the question/answer records

```json
{
  "id": 1,
  "q": "مَا هِيَ مَراتِبُ الدِّينِ؟",
  "a": "ثَلَاثَةٌ: الإِسْلَامُ، وَالْإِيمَانُ، وَالْإِحْسَانُ.",
  "section": "بَابُ الإِيمَانِ وَمَرَاتِبُ الدِّينِ"
}
```

| Field     | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `id`      | number | **yes**  | Unique within the file. Used as the `x-for` key, the favorites/quiz-history key, and (when `audio: true`) the audio filename via `audioPath`. |
| `q`       | string | **yes**  | The question. Rendered as plain text. |
| `a`       | string | **yes**  | The answer. Rendered as plain text; also tokenized for the *Build* and *Blank* quiz modes. |
| `section` | string | **yes**  | Chapter name. Must be **byte-for-byte identical** across items of the same chapter — it is the grouping key for the drawer list, browse filter, and quiz chapter dropdown. |

### Rules & conventions

- **`id` must be unique.** It feeds Alpine `:key`, so duplicates cause rendering bugs, and it
  identifies favorites/quiz history — changing an id later orphans user data for that card.
- **`section` strings are exact-match keys.** Slight differences (e.g. `"باب الصلاة"` vs
  `"بابُ الصلاةِ"`) create duplicate chapters. The chapter order in the UI = first appearance.
- **Keep `q`/`a` free of HTML** — they are rendered with `x-text` (escaped), so markup will show
  as literal text.
- **Arabic diacritics are fine.** Search normalizes diacritics and letter variants, so
  `مَرَاتِب` and `مراتب` both match.
- **Audio:** when `meta.audio` is `true`, every item must have a matching file at
  `audios/<id>.opus`; a missing file surfaces as an audio error in the UI.

---

## Validation checklist before committing a new file

- [ ] `meta.id` is unique across all content files and stable.
- [ ] Every item has a unique numeric `id` and a non-empty `q` and `a`.
- [ ] `section` strings are consistent (no near-duplicate chapters).
- [ ] `lang`/`dir` match the language (Arabic `rtl`, English `ltr`).
- [ ] If `audio: true`, all `audios/<id>.opus` files exist.
- [ ] File is registered in `CONTENT_FILES` (`src/services/content.js`) and `SHELL_ASSETS` (`sw.js`).
- [ ] Test with a hard reload (service worker caches aggressively — bump `CACHE_NAME` in `sw.js`
      when changing bundled content).

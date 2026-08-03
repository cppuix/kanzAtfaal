# Changelog

All notable changes to **Kanz Al-Aṭfāl** are documented here, back to the first
launch.

**Versioning note:** the app is a no-build static PWA (plain HTML/CSS + Alpine.js).
Each release bumps the service-worker cache name (`CACHE_NAME` in `sw.js`) — that
value is the release marker. Content files (`content.*.json`) are owned by the
publisher and are not listed here.

---

## [v50] — 2026-08-03 — Search & share polish

### Added
- **Jump to a card by number** — in Search, type a card number (e.g. `784`,
  `س ٧٨٤` or `#784`) to open that exact card. Arabic-Indic digits and the
  `س` / `Q` / `#` prefixes are all accepted.
- **Search → main view** — tapping a search result asks whether you'd like to
  open the card in the main Browse view; confirming takes you to its page,
  scrolls it into view, and flashes a gold ring around it.
- **Jump confirmation dialog** (bilingual) before leaving Search.

### Changed
- **Share cards redesigned** — a clean, book-like layout: smaller reading type,
  a divider above the answer, and more breathing room. The card grows taller to
  fit long answers; extremely long answers fade into a teaser that points to the
  app.
- **Share-card footer** now shows the real app URL (in Fira Code) instead of a
  hard-coded address.
- **Pagination** — clicking a page number now scrolls the list to the top of
  that page (previously it stayed put, which made the pager feel out of sync).
- Picking a chapter from the side menu now always lands on the Browse view for
  that chapter.

### Fixed
- The page indicator could highlight an out-of-range page number; it is now
  clamped.
- On update, the app could briefly keep serving old cached files; the service
  worker now always installs the fresh files.

---

## [v46–v49] — 2026-08-01 → 2026-08-03 — Share cards, dark theme, stability

### Share cards
- Share card **overhaul**: centered number pill, the app's own fonts, the real
  current URL in the footer (in Fira Code), and no more large answer panel.
- **Variable height** — the card grows to fit long answers, with a 2× cap and a
  "full answer inside" teaser fade for very long content.
- **Book-scale type** (40/34), an answer-section divider, and wider gaps between
  sections.

### Theme & stability
- App is now **dark-only** — a focused, consistent dark look (the light theme
  was removed after several redesign attempts).
- Brightened the dark text tones for better contrast.
- Quiz result gained a **"Back to setup"** button (localized, RTL-aware).
- Fixed a crash when tapping a multiple-choice answer during question
  transitions.
- Localized the Order-words **verify** button (was hard-coded Arabic).
- Developer tools (not part of the app UI): an interactive design studio for the
  palette, and a theme-lab for experimenting with a pixel theme.

---

## 2026-07-30 → 2026-07-31 — The big rebuild (major update)

A large internal rebuild (Alpine.js store as the single source of truth) that
made the app much faster and smoother, and enabled a wave of new features:

### Added
- **Dedicated Search tab** with highlighted results, scope filters (question /
  answer), chapter chips, and pagination.
- **Decluttered header** — menu · title · Language pill (fewer buttons, cleaner).
- **Full-page About & Settings** views (replacing the old pop-up panels).
- **Quiz overhaul**: setup rebuilt as clean fields (chapter → count → mode),
  sticky tabs (Normal / Weak / Stats), **per-activity-type stats**, a
  **weak-questions tab** for questions answered wrong, and a wide-screen layout.
- **Accessibility suite**: font sizes that scale *everything*, **font presets**
  (Tajawal / Amiri / Lateef / Montserrat / Fira Code / OpenDyslexic) with a live
  preview, high-contrast mode, and a screen-reader pass.
- **Instant content switching** between the three books (منتقى / كنز / Kanz EN).

### Changed
- Browse is much faster (paged card list — 30 at a time).
- The drawer became a pure chapter panel (no clutter).
- About-body text renders bold/emphasis correctly.

### Fixed
- Content-switch dropdown overflowed the screen on narrow devices.
- Search highlighting matched scattered letters instead of whole words.
- Card state went stale when switching books.

---

## 2026-04 — Play Store release (Android)

- Published on the **Play Store** (asset-links + privacy page).
- **Language button** in the top bar — switch Arabic / English anytime.
- **Auto-detects your browser language** on first open.
- Transparent app icon; offline-first caching polish.

---

## 2026-03 — Initial launch

The first version of the app:

- **Three books in two languages** — Arabic (منتقى / كنز) and English.
- **Browse & flip cards** with question + answer.
- **Search** across questions and answers.
- **Quiz** with four activity types: multiple choice, order the words, fill the
  blank, and listen.
- **Weak questions** — review what you got wrong.
- **Audio** for the Arabic content (منتقى).
- **Share** a question/answer as an image or text.
- **Font size & contrast** settings.
- **Offline support** (works without internet) with a splash screen, plus PWA
  install / home-screen support.

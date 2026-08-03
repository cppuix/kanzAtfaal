# Changelog

All notable user-facing changes to **Kanz Al-Aṭfāl** are documented here.

**Versioning note:** the app is a no-build static PWA (plain HTML/CSS + Alpine.js).
Each release bumps the service-worker cache name (`CACHE_NAME` in `sw.js`) — that
value is the release marker. Content files (`content.*.json`) are owned by the
publisher and are not listed here.

---

## [v50] — 2026-08-03

### Added
- **Jump to a card by number** — in Search, type a card number (e.g. `784`,
  `س ٧٨٤` or `#784`) to open that exact card. Arabic-Indic digits and the
  `س` / `Q` / `#` prefixes are all accepted.
- **Search → main view** — tapping a search result asks whether you'd like to
  open the card in the main Browse view; confirming takes you to its page,
  scrolls it into view, and flashes a gold ring around it.
- **Jump confirmation dialog** (bilingual) shown before leaving Search.

### Changed
- **Share cards redesigned** — a clean, book-like layout: smaller reading type,
  a divider above the answer, and more breathing room. The card grows taller to
  fit long answers; extremely long answers fade into a teaser that points to the
  app.
- **Share-card footer** now shows the real app URL (in Fira Code) instead of a
  hard-coded address.
- **Pagination** — clicking a page number now scrolls the list to the top of
  that page (previously the scroll position stayed put, which made the pager
  feel out of sync).
- Picking a chapter from the side menu now always lands on the Browse view for
  that chapter.

### Fixed
- The page indicator could highlight an out-of-range page number; it is now
  clamped.
- On update, the app could briefly keep serving old cached files; the service
  worker now always installs the fresh files.

---

## Earlier releases (condensed)

- **v49** — Search jump-to-card by number; drawer chapter now returns to Browse;
  page-number clamp (`safePage`); service-worker install revalidates against the
  network.
- **v48** — Share card: book-scale type (40/34), an answer-section divider, and
  wider gaps between sections.
- **v47** — Share card: variable height — the card grows to fit long answers,
  with a 2× cap and a "full answer inside" teaser fade for very long content.
- **v46** — Share card overhaul: centered number pill, app fonts, current-URL
  footer in Fira Code, and no more large answer panel.
- **v43–v45** — Quiz result "Back to setup" button; minor bug fixes (incl. an
  MCQ null-guard); theme-lab preview tool (developer-only).
- **v34–v42** — Quiz setup rebuilt (chapters → mode → count fields with sticky
  tabs, per-mode stats, weak-questions tab); wide-screen layout; quiz field
  alignment; localized quiz labels; app is now dark-only (focused dark theme);
  full smoke-test fixes.
- **v25–v33** — Decluttered header (menu · title · Language pill), dedicated
  Search tab with highlighted results, drawer as a pure chapter panel, full-page
  About & Settings views, content persistence, quiz-sentence→fields redesign.
- **v19–v24** — Accessibility: rem-based font scaling with size steps, font
  presets (Tajawal / Amiri / Lateef / Montserrat / Fira Code / OpenDyslexic),
  high-contrast mode, screen-reader pass, local offline fonts.
- **v9–v18** — Architecture refactor to Alpine store + services; fast browse
  pagination (30 cards/page); instant content switching; About/settings polish;
  content schema documented.

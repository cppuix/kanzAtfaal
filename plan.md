# Kanz Al-Aṭfāl — Migration Plan & Progress

## Overview

Migrating from monolithic vanilla JS (1758-line `app.js` → 1577 lines) to **Alpine.js** components with a reactive store, keeping the PWA zero-build-step nature. No bundler, no npm.

**Branch:** `refactor/alpine-migration`

---

## File Structure

```
index.html          ← Alpine directives on all templates
style.css           ← theme, animations, layout (minimal changes)
app.js              ← Alpine store + component definitions + old JS bridge code
lib/
  alpine.min.js     ← Alpine.js v3.15.12 (local for offline PWA)
sw.js               ← updated cache list
plan.md             ← this file
```

**Legacy (still present, mostly dead):**
- `data.js` — orphaned, not loaded in HTML (was an early embedded data source)
- `download-fonts.py` — font download script (unrelated)

---

## Progress: 19 commits, ~650 insertions, ~440 deletions

### ✅ Phase 1 — Foundation
- [x] Download Alpine.js → `lib/alpine.min.js`
- [x] Add `<script defer>` tag in HTML head
- [x] Create Alpine store (`Alpine.store('app')`) with all state fields
- [x] Add `qaCard` Alpine component (`Alpine.data('qaCard', ...)`)
- [x] Add `x-data` on `#app` wrapper
- [x] Add `x-cloak` CSS to prevent FOUC
- [x] Bump SW cache to v7, add alpine.min.js to shell assets
- [x] Fix: SW ready gate blocking init on first visit

### ✅ Phase 2 — Shell & Navigation
- [x] Topbar buttons: `@click` handlers for menu, settings, search
- [x] Drawer: `:class` open/close + `@click` on overlay to close
- [x] Bottom nav: `:class` active + `@click` view switching
- [x] View switching: `x-show` on browse/favorites/quiz views
- [x] About modal: `x-show="aboutOpen"`
- [x] Settings modal: `x-show="settingsOpen"`
- [x] Content switcher: Alpine `x-data` with local `menuOpen`, `x-for` options

### ✅ Phase 3 — Browse & Search
- [x] Card list: `x-for` over `filteredCards` with `qaCard` component
- [x] Search input: `x-model="$store.app.search"`
- [x] Scope buttons: Alpine `:class` + `@click`
- [x] Section filter pills: `x-for` over `SECTIONS`
- [x] Infinite scroll: `IntersectionObserver` via `initSentinel()`
- [x] Pagination: `visibleCount`, `PAGE_SIZE`, `visibleCards` computed

### ✅ Phase 4 — Favorites
- [x] Favorites view: `x-for` over `QA_DATA.filter(q => favorites.includes(q.id))`
- [x] Same `qaCard` component reused
- [x] Reactive fav count and empty state

### ✅ Phase 5 — Quiz (bridged)
- [x] Quiz setup: `x-show` for setup/game/result phases
- [x] Section select: `x-model`
- [x] Count buttons: `:class` active
- [x] Mode buttons: `:class` active
- [x] Store `initQuiz()` syncs to globals, calls old `renderQuizQuestion()`
- [x] Old answer functions sync back to Alpine store
- [x] Old `initQuiz()` made no-op (was leaving orphan code that killed script!)

### ✅ Phase 6 — Modals & Settings
- [x] About modal renders from `$store.app.CFG.about`
- [x] Settings: font size, contrast toggle, share link

### ✅ Phase 7 — Cleanup (partial)
- [x] Fixed duplicate `id="contentPopup"`
- [x] Removed `data.js` from SW cache
- [x] Removed `renderBrowse()`, `renderNextPage()`, `attachBrowseSentinel()`
- [x] Removed `getFiltered()`, `buildSearchFilters()`, `setSearchSection()`
- [x] Removed `buildSectionList()`, old `setSection()`
- [x] Removed `makeCard()`, `toggleCard()`, `toggleFav()`, `updateFavCount()`
- [x] Removed `renderFavorites()`
- [x] Made `toggleSearch()`, `toggleContentMenu()`, etc. no-ops

---

## Still Running as Old JS (bridge code)

These functions still exist in `app.js`. They're called by Alpine store methods or directly from the quiz rendering pipeline.

### Quiz rendering (~250 lines)
- `renderQuizQuestion()`, `renderMCQ()`, `renderBuild()`, `renderBlank()`, `renderListen()`
- `buildTileTap()`, `updateBuildAnswer()`, `checkBuildAnswer()`
- `answerBlank()`, `playListenAudio()`, `stopListenAudio()`, `answerListen()`
- `answerQuiz()`, `showQuizResult()`
- `hideAllModeZones()`

### Audio system (~60 lines)
- `playAudio()`, `resetAllPlayBtns()`, `stopAllAudio()`

### Share features (~180 lines)
- `copyQA()`, `shareAsImage()`, `roundRect()`, `wrapText()`

### Settings panel (~40 lines)
- `buildSettingsPanel()`

### Helper functions (keep as-is)
- `normalizeAr()`, `fuzzyScore()`, `buildHighlight()`, `escHtml()` — used by store computed props
- `loadContent()`, `saveFavorites()`, `loadStorage()`, `loadQuizHistory()` — data persistence
- `toArabic()`, `favStarSVG()` — formatting
- `spawnSparkles()`, `showToast()` — effects

### Helper functions (keep as-is)
- `normalizeAr()`, `fuzzyScore()`, `buildHighlight()`, `escHtml()` — used by store computed props
- `loadContent()`, `saveFavorites()`, `loadStorage()`, `loadQuizHistory()` — data persistence
- `toArabic()`, `favStarSVG()` — formatting
- `spawnSparkles()`, `showToast()` — effects

---

## Remaining Work

### ✅ Done (recent cleanup)
- [x] **Remove old `init()` event listeners** — gutted entirely (23 listener registrations removed). Only content loading remains.
- [x] **Remove old `switchView()`** — Alpine `x-show` + `:class` handles view visibility.
- [x] **Remove content switcher old code** — `buildContentMenu()`, `positionContentMenu()`, `toggleContentMenu()`, `closeContentMenu()` removed.
- [x] **Remove `openDrawer/closeDrawer/closeAbout/toggleSearch/openSettings/closeSettings`** — all handled by Alpine store.
- [x] **Remove old `switchContent()`** — replaced by Alpine store method.

### Remaining Medium Priority
- [ ] **Convert quiz rendering to Alpine** — `renderMCQ()`, `renderBuild()`, etc. create DOM elements manually. Could be Alpine `x-for` templates. Complex but cleaner.
- [ ] **Clean up `style.css`** — remove `.hidden`, `.active` class toggling rules that are now handled by Alpine. Keep theme and animations.

### Low Priority
- [ ] **Remove `data.js`** — orphaned file, not loaded by HTML. Just sits there.
- [ ] **Add `x-transition` animations** — replace manual CSS animation classes with Alpine transitions for smoother feel.
- [ ] **Inline SVG constants** — `CHEST_SVG`, `PLAY_SVG`, `STOP_SVG` exposed to `window` for Alpine access. Could be moved into store or components.
- [ ] **Document content JSON schema** — for contributors adding new languages/books.

### Nice-to-Have
- [ ] Convert `buildSettingsPanel()` to Alpine template
- [ ] Convert audio player to Alpine component
- [ ] Add keyboard navigation for cards
- [ ] Add loading states for content switching

---

## Known Issues

1. **Quiz DOM manipulation conflicts** — Old JS toggles `.hidden` class (with `!important`) while Alpine controls via `x-show`. Both work but the old `.hidden` can override Alpine's inline style. So far no visible bugs.

2. **Service worker cache** — Old SW (v6) cached the pre-migration `app.js`. Current SW is v7 with updated files. Users may need a hard refresh to clear stale cache.

3. **`content.en.json`** (legacy 0-item stub, never loaded) — REMOVED in post-refactor cleanup.

---

## Quick Reference: Alpine Store API

**Store name:** `app` (accessed via `$store.app` or `Alpine.store('app')`)

### Key State Properties
| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `CFG` | Object | `{}` | Content config + UI strings |
| `QA_DATA` | Array | `[]` | All Q&A items |
| `SECTIONS` | Array | `[]` | Unique section names |
| `view` | String | `'browse'` | Active view |
| `section` | String | `'all'` | Selected chapter |
| `search` | String | `''` | Search query |
| `searchScope` | String | `'both'` | Search scope (q/a/both) |
| `favorites` | Array | `[]` | Favorited question IDs |
| `openCards` | Array | `[]` | Open/flipped card IDs |
| `drawerOpen` | Boolean | `false` | Drawer visibility |
| `searchOpen` | Boolean | `false` | Search bar visibility |
| `quizPhase` | String | `'setup'` | Quiz phase (setup/game/result) |
| `quizMode` | String | `'mcq'` | Quiz mode |
| `fontSize` | String | `'md'` | Font size preset |
| `highContrast` | Boolean | `false` | High contrast mode |

### Key Computed Properties
| Property | Description |
|----------|-------------|
| `filteredCards` | Cards filtered by section + search |
| `visibleCards` | Paginated slice of filteredCards |
| `hasMore` | Whether more cards to load |
| `currentQuestion` | Current quiz question |
| `quizProgress` | Quiz progress percentage |

### Key Methods
| Method | Purpose |
|--------|---------|
| `toggleDrawer()` | Toggle drawer open/close |
| `switchView(view)` | Switch active view |
| `setSection(sec)` | Select chapter |
| `toggleFav(id)` | Toggle favorite |
| `toggleCard(id)` | Flip card open/close |
| `toggleSearch()` | Toggle search bar |
| `initQuiz()` | Start new quiz |
| `nextQuizQuestion()` | Advance to next question |
| `retryQuiz()` | Reset to quiz setup |
| `switchContent(file)` | Change content source |
| `loadMore()` | Load next page of cards |

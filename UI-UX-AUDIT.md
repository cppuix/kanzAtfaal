# UI/UX Audit — Kanz Al-Aṭfāl (كنز الأطفال)

> **Date:** July 30, 2026
> **Branch:** `refactor/alpine-migration`
> **Tested on Desktop Chromium (800×900 viewport)**

---

## ✅ What Works Well

### Splash Screen
- Elegant animated chest SVG with bob animation
- Smooth fade-out transition into app
- Loading dots animation
- Good first impression — sets the gold/dark green theme tone

### Top Bar
- Clean sticky header with menu, title, and action buttons
- Ornamental diamond (`❖`) separator below header adds polish
- Content switcher popup works correctly (tested — all 3 options render and switch content)

### Drawer / Navigation
- Smooth slide-in animation with proper z-index stacking
- Section list with counts, active state indicator bar
- Scrollbar custom-styled and thin
- All 4 nav actions (Browse, Favorites, Quiz, About) functional
- Drawer closes on overlay click

### Browse View (Card System)
- **Flip card animation** is smooth and well-timed (0.52s cubic-bezier)
- Chest icon opens (lid rotates, coins appear) — delightful touch
- Sparkle particles on card open and quiz correct answers
- Card entrance animation (staggered `cardIn`)
- Section tags, question numbers, answer labels all properly localized
- Play audio button, favorite star, copy, share-as-image — all functional

### Search
- Scope filtering (both / question / answer) works correctly
- Section filter pills scroll horizontally
- Fuzzy search with diacritic normalization works
- Highlighted matches (`<mark>`) in search results
- Close button to dismiss search

### Quiz System
- **4 quiz modes**: MCQ, Build (word ordering), Blank (fill-in), Listen (audio-based)
- Progress bar with percentage
- Score tracking
- Quiz history saved per question (correct/wrong counts)
- Weak spots detection (`getWeakIds`)
- Result screen with chest animation, score, tiered messages (try again / good / great / perfect)
- Retry button

### Settings
- Font size scaling (3 levels) — CSS custom property `--font-scale`
- High contrast mode — swaps all colors to higher contrast
- Share app URL button
- Slide-up modal animation

### About Modal
- Chest icon with bob animation
- Rendered from content JSON (title, body paragraphs, contacts)
- Slide-up animation
- Contact links (email, Telegram)

### Arabic / LTR Support
- Full RTL layout
- Arabic numeral conversion (`toArabic`)
- LTR overrides via `[dir="ltr"]` selectors for English content
- Content switching persists via `localStorage`

### Misc
- Toast notification system for saves/copies
- Sparkle particle system on correct answers and card opens
- Win shimmer overlay on perfect quiz score
- Scrollbar styling throughout
- PWA manifest and service worker

---

## 🔴 Bugs (Must Fix)

### 1. Favorites counter shows `undefined سؤال`
- **File:** `index.html:218`
- **Cause:** `$store.app.favorites.size` — `favorites` is an **array** (not a Set since Alpine can't proxy Sets), so `.size` is undefined.
- **Fix Applied:** Changed to `$store.app.favorites.length`.

### 2. Favorites empty state visibility uses `.size`
- **File:** `index.html:267`
- **Cause:** Same `.size` vs `.length` issue — the empty state (`#noFavs`) never hides when there are favorites.
- **Fix Applied:** Changed to `$store.app.favorites.length > 0`.

### 3. About button in drawer doesn't close drawer
- **File:** `index.html:129`
- **Cause:** `@click="$store.app.aboutOpen = true"` doesn't call `closeDrawer()`, so the drawer overlay remains and blocks interactions.
- **Fix Applied:** Added `$store.app.closeDrawer()` to the click handler.

---

## 🟡 Issues & Improvements (Should Fix)

### 4. Content popup has no outside-click-to-close
- **File:** `index.html:72-78`
- **Issue:** The globe button toggles `menuOpen`, but there's no `@click.outside` handler on the wrapper. Users who open the popup must click the globe again to close it.
- **Fix:** Add `@click.outside="menuOpen = false"` to the `.content-switch-wrapper` div.

### 5. Search calls `renderBrowse()` — a no-op
- **File:** `index.html:90-91`
- **Issue:** `x-init="$watch('$store.app.search', ...)"` and `@input.debounce` both call `renderBrowse()`, but that function is now a stub (`function renderBrowse() {}`). These are harmless dead code but misleading.
- **Fix:** Remove the `renderBrowse()` calls or make them meaningful (the store's `filteredCards` computed property already reactively updates the view).

### 6. Duplicate section count computations
- **File:** `index.html:116` — each drawer section item computes `$store.app.QA_DATA.filter(q => q.section === sec).length`
- **Issue:** This runs a filter for every section item on every Alpine re-render. With 24 sections and 1536 questions, this is 24× filter passes.
- **Fix:** Precompute a `sectionCounts` map in the store or add it to the `SECTIONS` array.

### 7. Build check button visibility — Alpine vs JS conflict
- **File:** `index.html:349` and `app.js` (old `updateBuildAnswer`)
- **Issue:** The `:class` binding on `#buildCheck` toggles `hidden` based on `quizAnswered` and `quizMode`, but the old JS code (`checkBtn.classList.add('hidden')`) also manages this class independently. Alpine will override JS changes on re-render.
- **Fix:** Remove Alpine's `:class` from `#buildCheck` and let the old JS fully control it, OR refactor `updateBuildAnswer` to use Alpine's store.

### 8. Quiz feedback element styling via old JS is fragile
- **File:** `app.js` — `answerQuiz()`, `checkBuildAnswer()`, `answerBlank()`, `answerListen()` all manipulate `quizFeedback` via `document.getElementById('quizFeedback')`.
- **Issue:** The feedback element is not Alpine-controlled — the old JS renders feedback text and adds classes directly to the DOM. Alpine's re-render could wipe these changes.
- **Fix:** Migrate quiz feedback to use `$store.app.quizFeedback` (text + type) in the store and bind with `x-text` and `:class`.

### 9. Page title doesn't update when switching content
- **File:** `app.js` — `loadContent()` and store's `switchContent()`
- **Issue:** The `<title>` tag still shows "منتقى كنز الأطفال" after content switch. For English content, it should update to the English title.
- **Fix:** Add `document.title = CFG.ui.appTitle || 'منتقى كنز الأطفال'` in `loadContent()`.

### 10. No loading state during content switch
- **File:** `index.html` + `app.js` — `switchContent()`
- **Issue:** When switching from a 1536-question content to another, the fetch + re-render can take ~100-300ms on slow connections with no visual feedback.
- **Fix:** Show a brief loading indicator or skeleton during content fetch.

---

## 🟠 UX Polish (Nice to Have)

### 11. Card height jitter on flip
- **File:** `style.css` — `.qa-card-flipper`
- **Issue:** Uses CSS Grid trick where both faces occupy the same grid cell. This means the wrapper height = max(front height, back height). If the answer is much longer than the question, the card expands when flipped open, causing layout shift.
- **Fix:** Set a `min-height` on `.qa-card-wrap` or use `height: auto` with transition.

### 12. No scroll-to-top when switching sections
- **Issue:** When tapping a section in the drawer, the browse view scroll position stays where it was.
- **Fix:** In `setSection()`, add `window.scrollTo({ top: 0, behavior: 'smooth' })` or scroll the `#mainContent`.

### 13. Quiz section dropdown options not rebuilt after content switch
- **File:** `app.js` store's `switchContent()` — syncs `SECTIONS` but doesn't rebuild the `<select>` options for `#quizSection`.
- **Issue:** Actually it does this: the store method calls `loadContent(file)` (old function) which calls `buildSettingsPanel()` but doesn't rebuild the quiz section select.
- **Fix (already partial):** The store's `switchContent()` does rebuild quiz options — but the old `loadContent()` function doesn't. If content is loaded without going through the store method, quiz options stay stale.

### 14. Infinite scroll sentinel stays visible after all loaded
- **File:** `index.html:201`
- **Issue:** `x-show="$store.app.hasMore"` on the sentinel div — after all items are loaded, `hasMore` becomes `false` and the sentinel hides. But if `loadMore()` is called when `visibleCount >= filteredCards.length`, `hasMore` is false and the observer should disconnect.
- **Status:** The store's `loadMore()` checks `this.hasMore`, but `initSentinel()` doesn't disconnect when there's nothing to load.

### 15. Bottom nav active state on About button
- **Issue:** The "About" button is in the drawer, not in the bottom nav. There's no active indicator for the about modal. Minor since the about modal is a popup.

### 16. No pull-to-refresh or offline indicator
- **Issue:** The app is a PWA but there's no offline status indicator. If the user loads the app offline for the first time, the splash screen stays forever (content fetch will fail).
- **Note:** The `init()` function now runs on `DOMContentLoaded` (not gated on SW), but content fetch will still fail without network.

### 17. Share-as-image canvas uses hardcoded fonts
- **File:** `app.js` — `shareAsImage()` sets font to `'Amiri, serif'` or `'Georgia, serif'`
- **Issue:** If the fonts haven't loaded yet (or fail to load), the canvas text might render in a fallback serif font with different metrics.
- **Status:** `await document.fonts.ready` is called first, so this should be fine.

### 18. Audio player doesn't show loading state
- **File:** `app.js` — `playAudio()`
- **Issue:** When clicking play, the button immediately switches to the stop icon, but there's no loading spinner while the audio file fetches over the network.
- **Status:** Works fine for cached audio (PWA). Could add a loading indicator for first-time fetches.

---

## 📊 Summary

| Category | Count |
|----------|-------|
| 🔴 Bugs (critical) | 3 |
| 🟡 Issues (should fix) | 7 |
| 🟠 Polish (nice to have) | 8 |
| **Total** | **18** |

### Already Fixed in This Session
1. `favorites.size` → `favorites.length` (×2)
2. About button now closes drawer before opening modal

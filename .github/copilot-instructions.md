---
applyTo: "**/*"
---

# Architecture & Conventions (for AI)

## Stack
- No npm, no bundler, no Node.js build step.
- Plain HTML, CSS, vanilla JS.
- Alpine.js for reactivity (loaded from `lib/alpine.min.js`).
- JSON content files for multilingual data.
- Native ES modules (`type="module"`) for services.
- Service worker (`sw.js`) for offline support.

## Inviolable Rules

1. **Store owns all application state.**  
   `Alpine.store('app')` is the single source of truth. Never keep duplicate state in components or DOM.

2. **Services own all business logic.**  
   Audio, storage, content loading, sharing — each in its own module (`src/services/`).  
   They export functions; they never touch the DOM directly.

3. **Templates contain no business logic.**  
   Use Alpine directives only (`x-show`, `x-bind`, `x-for`, `x-text`, `x-html`, `x-model`, `x-on`).  
   Complex logic belongs in store methods or service functions.

4. **CSS owns presentation & animations.**  
   No inline styles, no direct style manipulation. Use CSS variables for theme values.

5. **The DOM is a rendering target, never a source of truth.**  
   Never read state from DOM nodes. Never mutate DOM directly (`querySelector`, `classList`, `innerHTML`, `appendChild`).  
   If you must interact with a browser API (e.g., share sheet), isolate it, but still do not store state in the DOM.

6. **Every state change goes through a named store action.**  
   Prefer `store.enterQuizMode()` over `store.quizPhase = 'game'`.  
   Actions are self‑documenting for the model.

7. **Each subsystem has exactly one owner.**  
   Audio → `audio.js`, Persistence → `storage.js`, Content → `content.js`, UI → Alpine templates, Animation → CSS.

## Data Flow

JSON → Content Service → Store → Templates → CSS → User → Store Actions → Persistence

No arrows bypassing the store.

## Component Rules (Alpine)
- `x-data` components manage **only** local, ephemeral UI state (e.g., dropdown open, hover).  
- Shared domain data must come from `$store.app` via getters, never by copying into the component.  
- If a component receives data via props (e.g., `x-data="qaCard(item.qa)"`), treat it as **read‑only**. The store is the only source of updates.  
- When the underlying dataset identity changes (e.g., language switch, content reload), bump a version counter on the store (e.g., `store.cardVersion++`) and use it in `x-for` keys: `:key="qa.id + '-' + $store.app.cardVersion"`.  
- **Never** use `:key="index"`. Always use a unique, stable ID plus a version counter if data can be replaced.

## Preferred Patterns
- `:class="{ active: $store.app.view === 'browse' }"` over manual class toggling.  
- `x-show` / `x-if` over hiding with CSS `.hidden` class.  
- `x-transition` for animations; keep animation logic in CSS.  
- `x-model` for inputs bound to store.

## Forbidden Anti‑patterns
- `document.querySelector(...)` inside Alpine‑related code.  
- `element.classList.add(...)` when Alpine could `:class`.  
- `element.innerHTML = ...` when Alpine could `x-html`.  
- Duplicating store state in `x-data`.  
- Mixing imperative DOM updates with Alpine directives.  
- Adding new libraries or build steps.

## Internationalization & RTL
- Direction is set on `<html dir="...">`. Use CSS logical properties (`margin-inline-start`, `padding-inline-end`, etc.) instead of `left`/`right`.  
- Dynamic text must be bound via `x-text` or `x-html`, not hardcoded.

## Testing & Debugging
- Manual test checklist in `manual-tests.md`.  
- State invariants: "only one audio playing", "every card has unique ID", etc.  
- When debugging a UI bug, always check: store mutation → reactivity → `x-for` keys.  
- A console‑based assertion harness exists in `js/testing/` (see AGENTS.md for usage).
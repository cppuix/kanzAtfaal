# How to Work with This Codebase

## Before You Start
- Read `.github/copilot-instructions.md` — it defines the rules.
- Check the architecture: store → services → templates.
- The store is `Alpine.store('app')`. All state lives there.

## Debugging Process
1. Examine the store via browser console: `Alpine.store('app')`.
2. Verify reactivity: is the property being updated? Is it a getter? Is the `x-for` key correct?
3. If UI is stale after data change, bump `store.cardVersion` and ensure `x-for` keys use it.
4. Never suggest DOM manipulation to fix a rendering issue.

## Making Changes
1. Identify which service owns the functionality.
2. Modify the store method first, then update the template if needed.
3. If adding a new feature:
   - Add state to store.
   - Add action methods.
   - Add service function (if side‑effects needed).
   - Bind UI via Alpine directives.
4. Do not introduce new libraries or build steps.

## Testing
- Run `manual-tests.md` checklist after significant changes.
- For unit tests, use the console‑based assertion harness: `window.__RUN_TESTS__()`.
- If you write new tests, add them to `js/testing/appStore.test.js` or similar.
---
applyTo: "**/*.js"
---

- Alpine store is accessed as `Alpine.store('app')` in JS modules, `$store.app` in templates.
- Use `Alpine.store('app').doSomething()` for actions; never mutate store properties directly from outside.
- When iterating with `x-for`, always include a version counter in the key if the dataset can be replaced (e.g., content switch).
- Prefer named store methods for state transitions.
- `x-data` components should treat props as read‑only. Shared state lives in the store.
- Do not import Alpine in service modules; only use `Alpine.store()` if needed.
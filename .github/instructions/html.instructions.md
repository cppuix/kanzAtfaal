---
applyTo: "**/*.html"
---

- All reactive UI must use Alpine directives (`x-bind`, `x-show`, `x-for`, `x-text`, `x-html`, `x-model`, `x-on`).
- Do **not** add new `<script>` tags unless absolutely necessary.
- Keep `x-data` components minimal; reference `$store.app` for shared data.
- Use `x-html` only when content is already sanitized (e.g., highlighted search results). Otherwise use `x-text`.
- Respect RTL: direction is set on `<html>` and handled via CSS logical properties; do not hardcode `dir` on individual elements.
- For `x-for`, always include a version counter in the key if data can be replaced.
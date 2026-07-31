---
applyTo: "**/*.css"
---

- No `!important` unless overriding third‑party styles.
- All animations/transitions belong here, never in JS.
- Use CSS variables for theme values (font scale, contrast).
- For RTL, use logical properties (`margin-inline-start`, `padding-block`, `inset-inline`, etc.).
- Maintain existing class naming conventions; do not rename existing classes without strong reason.
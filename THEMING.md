# BuildingSchmidt color themes

The active theme is **Studio Green**. Its palette is defined in
[`assets/theme.css`](assets/theme.css), which loads **before** the four ordered component stylesheets:
`assets/site.css`, `assets/site-workspaces.css`, `assets/site-controls.css`,
and `assets/site-polish.css`. Preserve this load order to retain the cascade.

## How to change a color

Edit the semantic `--color-*` values in `assets/theme.css`, not individual
components. A change to `--color-accent` automatically affects primary buttons,
active navigation, progress indicators, note accents and focus affordances.

Components should reference a **role**, not a particular shade:

```css
.example-panel {
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.example-panel .primary {
  color: var(--color-on-accent);
  background: var(--color-accent);
}
```

Use these groups:

| Purpose | Tokens |
|---|---|
| Page structure | `page`, `sidebar`, `header`, `surface`, `surface-muted`, `surface-raised`, `surface-inset` |
| Interaction | `selected`, `hover`, `accent`, `accent-hover`, `accent-soft`, `focus` |
| Typography | `text`, `text-muted`, `text-subtle`, `on-accent`, `on-media` |
| Borders | `border`, `border-strong` |
| Status | `info`, `danger`, `success`, `warning` |
| Photos and shadow | `media-backdrop`, `shadow` |

All names above are prefixed with `--color-`.

### Why image overlays are separate

White text over a dark photo must stay white even in a light theme. Use
`--color-on-media` and `--color-media-backdrop` only for image canvases,
lightboxes, scrims, and overlaid photo controls. Regular dialogs and text
panels use `--color-surface` and `--color-text`.

### Adding a theme later

Add another override block **after** the default palette:

```css
:root[data-theme="another-theme"] {
  --color-page: ...;
  --color-text: ...;
  /* Supply each semantic token required for a fully distinct palette. */
}
```

The default theme does not require JavaScript or user preferences. Future
theme-selection UI can set `document.documentElement.dataset.theme`
without rewriting component CSS.

### Guardrails

Run `npm test` or `npm run check`. The theme tests verify:

- Theme tokens load before component styles.
- Every referenced `--color-*` token has a definition.
- No new hexadecimal or `rgb()` / `rgba()` values are added to the
  component stylesheets.
- Primary text, secondary text, and buttons meet a 4.5:1 contrast
  baseline on the standard surfaces.

Photos, inline SVG artwork, and physical part drawings are **content**, not
UI theme colors; they should retain their original artwork colors.

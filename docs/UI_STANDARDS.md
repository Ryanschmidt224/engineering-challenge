# Current UI standards

Shared rules belong to a component or token owner and apply across Projects, Workshop, Info Bits and settings. Avoid a page-specific override when the shared component is responsible.

- `theme.css` owns semantic colors, spacing, type, control dimensions and breakpoints. Use those tokens rather than literal fallback colors.
- `ui-kit.css` and `BSUI` own framed buttons, quiet actions, paired label/value fields, disclosure sections, section-header edits and status feedback. `.button` and `.ui-button` share the same definition; they are not separate visual systems.
- Labels sit beside bounded inputs on wide screens and stack on phones. Keep related controls close, with usable touch targets. Do not use percentage-wide empty label columns.
- Disclosure sections default closed unless the workflow needs immediate input. Section edits belong in the expanded header; creation actions belong in the body. Status feedback sits outside document flow so refresh does not move the page.
- Tree labels put part number before name, share the navigation selection treatment and show assembly connectors. Reordering and drag operations use guarded current commands, retaining revision/history behavior.
- Photos use one shared image-stage pencil below the right edge, an explicit Done action and normal-flow tools. Multiple images use galleries. Choose files, drag/drop and image paste share native selection helpers; persistence stays with the owning feature.
- Rich HTML is not accepted as ordinary user content. Use text nodes for names, descriptions, records and Info Bits. Keep focus, keyboard access, dialog dismissal and native file behavior tested.

Current page layout owners are `project-workspace.css`, `family-workshop.css`, `knowledge.css`, `project-directory.css`, `photo-controls.css` and the shared kit. The previous `site*.css` cascade and old project renderers are retired. See [CSS_INVENTORY.md](CSS_INVENTORY.md) for current measurements.

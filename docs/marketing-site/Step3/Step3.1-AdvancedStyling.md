# Advanced Theme and Custom CSS Styling

Theme controls are the normal way to set a marketing site's palette, typography,
shape, width, and spacing. Custom CSS is the advanced escape hatch for an
operator who needs a targeted visual adjustment.

## Supported hooks

The current BakerRang site system exposes these supported advanced styling hooks:

```css
[data-br-site] { }
[data-br-section="services"] { }
[data-br-section-id="section-id"] { }
```

Use `data-br-section` for preferred type-level styling. For example, it can
style every Services section. Use `data-br-section-id` only when an adjustment
must target one current section instance. Section IDs are opaque implementation
identifiers, not meaningful names: duplicated or recreated sections receive new
IDs. Do not use UUID-based `section-<uuid>` DOM IDs as the long-term Custom CSS
API.

These are the supported advanced hooks for the current BakerRang site system.
Prefer them to generated utility class names, DOM structure selectors, or other
implementation details, which are not stability promises.

Each rendered page also has an immutable instance hook on its SiteShell root:
`[data-br-page="<page-id>"]`. Page IDs, rather than mutable slugs, are the
stable Custom CSS identity for a page.

The expanded section library also exposes meaningful role hooks where needed:
`[data-br-role="step"]`, `[data-br-role="cta-button"]`, and
`[data-br-role="logo"]`.
`[data-br-role="button"]` remains the intentionally shared hook for ordinary
buttons, including About; `cta-button` is reserved for the CTA section's
specific primary action.

## Theme variables

`[data-br-site]` receives the following Theme variables:

```css
--site-primary
--site-primary-fg
--site-accent
--site-accent-fg
--site-bg
--site-fg
--site-surface
--site-border
--site-muted
--site-radius
--site-radius-large
--site-content-width
--site-section-space
--site-section-space-lg
--site-hero-space
--site-hero-space-lg
--site-heading-font
--site-body-font
```

`--site-primary-fg`, `--site-accent-fg`, surface, border, muted text, radii,
and spacing values are derived from the semantic Theme fields. Theme variables
are declared inline on the `[data-br-site]` SiteShell root, so Custom CSS
precedence depends on where an override is applied.

Ordinary Custom CSS property overrides on a section or descendant work normally:

```css
[data-br-section="gallery"] {
  border-color: var(--site-primary);
}
```

You can override a Theme variable for a section subtree without `!important`:

```css
[data-br-section="services"] {
  --site-primary: #ff0000;
}
```

That value is inherited by the Services section and its descendants. To override
a root Theme variable directly on `[data-br-site]`, `!important` is required
because the Theme variable is an inline declaration on the same element:

```css
[data-br-site] {
  --site-primary: #ff0000 !important;
}
```

The Custom CSS sanitizer permits `!important`. Custom CSS should be narrow and
intentional; it is a separate advanced trust boundary from the constrained Theme
editor.

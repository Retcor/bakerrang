That gives us enough direction to define the next product-focused roadmap. I would **not put production deployment anywhere in the immediate sequence**.

The goal after 1.23 should be: turn the solid backend/platform foundation we've built into something that actually feels like a usable BakerRang product.

## Revised roadmap

### 1.23c — Real Custom-Domain Verification

**Next immediate step.**

Use `custom-dev.bakerrang.com` to validate the complete deployed lifecycle:

* DNS ownership verification
* activate domain
* real HTTPS
* `/` and `/contact`
* canonical URLs / metadata
* shared URL redirects
* lead submission
* disable/reactivate
* remove domain

Once that passes:

**Step 1.23 = COMPLETE.**

---

### 1.24 — Portal Visual Foundation

Turn the Portal from functional scaffolding into the foundation of a polished SaaS application.

This would establish:

* BakerRang logo/brand integration
* color palette derived from your existing branding
* typography
* application shell
* sidebar/navigation
* top-level page layout
* cards/panels
* buttons
* inputs
* dialogs
* tables/lists
* empty/loading/error states
* responsive behavior
* consistent spacing and sizing

The important part is that we build a **reusable Portal design system**, rather than styling each existing screen independently.

We'd then migrate the existing Business, Website, Leads, Media, Domains, etc. screens into it.

When we start this step, I'll have you provide the logo you're currently using so the design direction is actually based on BakerRang.

---

### 1.25 — Site Theme & Styling Controls V1

Give each business useful design customization without turning BakerRang into Wix.

I think the initial controls should be approximately:

**Brand colors**

* primary
* secondary/accent
* background
* text

**Typography**

* heading font
* body font

Probably from a curated set initially rather than arbitrary font uploads.

**Shape/style**

* button style
* border radius

**Layout**

* content width
* general section spacing

**Sections**

* default/light/accent/dark-style backgrounds where appropriate

These would feed a consistent theme model used by all renderer components.

The goal is:

> enough control that two BakerRang sites can look meaningfully different, while still making it difficult to create a terrible-looking site.

---

### 1.26 — Working-Site Preview

This should happen **before adding much more content functionality**.

The Portal needs an obvious way to see:

> “This is what I am about to publish.”

We already have the architectural advantage of separate **working** and **published** content, so we should leverage it.

Something approximately like:

```text
Website Editor

+----------------------------------------------+
| Hero                                         |
| Services                                     |
| About                                        |
| ...                                          |
+----------------------------------------------+

          [ Preview ]    [ Publish ]
```

Preview would render the **working copy**, while the real public site continues rendering the published snapshot.

Nothing fancy yet. No drag-around visual editor or inline editing.

I'd probably give the preview:

* desktop view
* mobile view
* refresh/update as edits are saved
* clear "Preview — not published" indication

This becomes especially valuable once styling controls arrive.

---

### 1.27 — Additional Core Sections

Add the four content features you identified.

#### About

Something like:

* heading
* body/content
* optional image

#### FAQ

Repeatable:

```text
Question
Answer
```

with ordering/removal like Services and Testimonials.

Public renderer could use an accordion-style presentation.

#### Business Hours

Structured data rather than arbitrary text:

```text
Monday       8:00 AM – 5:00 PM
Tuesday      8:00 AM – 5:00 PM
...
Sunday       Closed
```

That also gives us structured data we can eventually expose through SEO/JSON-LD.

#### Social Links

Structured links such as:

* Facebook
* Instagram
* YouTube
* LinkedIn
* X
* TikTok

Only configured networks render.

All four should participate in the existing section composition/order/removal architecture rather than introducing one-off behavior.

---

### 1.28 — Advanced Custom CSS

Provide an escape hatch for someone who needs more than the normal theme controls.

Something like:

```text
Website
  └── Advanced
       └── Custom CSS
```

This would be **CSS only**, never arbitrary JavaScript.

I'd put some deliberate boundaries around it:

* tenant-specific
* working vs published isolation
* preview before publishing
* size limit
* no `<style>`/HTML required; just CSS
* probably block or restrict dangerous external imports
* expose stable renderer classes/data attributes so custom CSS doesn't depend on fragile generated class names

For example:

```css
[data-section="hero"] {
  min-height: 650px;
}

[data-section="services"] .service-card {
  border-width: 2px;
}
```

Normal customers shouldn't need this. It's the advanced override for you or someone who knows CSS.

---

### 1.29 — Website Editing UX Polish

Once all those capabilities exist, do a focused pass on the editor itself.

For example:

```text
Website

  Content
    Hero
    Services
    About
    Gallery
    Testimonials
    FAQ
    Business Hours
    Contact

  Design
    Branding
    Theme
    Custom CSS

  Business
    Profile
    Social Links

  Publishing
    Preview
    Domain
```

Not necessarily those exact labels, but the goal is to make everything we've accumulated feel like **one coherent product** rather than twenty successive engineering steps.

This is where we'd improve:

* navigation between editors
* dirty/saved state
* publishing feedback
* validation messages
* section ordering UX
* destructive-action confirmation
* preview workflow

---

### 1.30 — DEV Product Readiness Pass

Then we'd stop adding features briefly and use BakerRang like an actual customer would.

Create a complete business site from scratch and look for:

* awkward workflows
* missing validation
* visual inconsistencies
* renderer problems
* mobile problems
* accessibility basics
* broken empty states
* publishing confusion
* poor error handling
* missing operational visibility

This is essentially:

> Can we comfortably build a real local-business website with the thing we've created?

Only after that would I start talking about a production roadmap.

---

## Things I'd explicitly leave for later

Based on what you said, I would keep these out of the immediate roadmap:

```text
Multiple arbitrary pages
Full visual drag-and-drop builder
Inline WYSIWYG editing
Service detail pages
Complex header builders
Complex footer builders
Arbitrary font uploads
Advanced responsive controls
Per-element styling controls
Animations/effects system
Custom JavaScript
Plugin/widget ecosystem
```

We can add them when actual use shows that they're valuable.

So our roadmap now has a much more sensible shape:

```text
1.23c  Custom-domain E2E
       ↓
1.24   Portal visual foundation
       ↓
1.25   Site theme controls
       ↓
1.26   Working-site preview
       ↓
1.27   About / FAQ / Hours / Social
       ↓
1.28   Custom CSS
       ↓
1.29   Editor UX polish
       ↓
1.30   DEV product-readiness pass
       ↓
       Future roadmap / eventually Production
```

I think this gets us much closer to the original vision: **build the platform correctly first, then make it genuinely pleasant and useful before worrying about production.**

We're ready to return to **Step 1.23c** now and finish `custom-dev.bakerrang.com`.

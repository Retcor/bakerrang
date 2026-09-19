---
name: BakerRang Platform
description: A warm, confident workspace for building and managing business websites.
colors:
  brand-yellow: "#fec51c"
  brand-yellow-hover: "#f2b900"
  brand-yellow-active: "#dda600"
  brand-ink: "#1c1f29"
  brand-subtle: "#fff8dc"
  workspace-bg: "#f5f6f8"
  surface: "#ffffff"
  surface-muted: "#f8f9fb"
  border: "#e1e4e9"
  border-strong: "#c8cdd5"
  foreground: "#202329"
  foreground-muted: "#626975"
  sidebar: "#292b2f"
  sidebar-deep: "#1c1f29"
  sidebar-muted: "#b8bec8"
  focus: "#1769aa"
  success: "#277a4b"
  warning: "#9a6500"
  danger: "#b42318"
  info: "#1769aa"
typography:
  body:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontWeight: 600
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  xl: "1rem"
spacing:
  control-sm: "0.75rem"
  control-md: "1rem"
  page-mobile: "1rem"
  page-desktop: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-yellow}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.brand-yellow-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  sidebar-nav-active:
    backgroundColor: "{colors.brand-yellow}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
---

# Design System: BakerRang Platform

## Overview

**Creative North Star: "The Business Workshop"**

BakerRang is a polished workspace for actively building, managing, and improving a business presence. It should feel capable and professional without slipping into the visual language of an internal admin console. Warmth comes from a disciplined yellow-and-charcoal identity; confidence comes from clear structure, generous working room, and controls that communicate purpose immediately.

The Portal is an Operate surface: supporting controls should make the primary work visible and easy to act on, not compete for attention. For the website builder, the live site preview is the working canvas; sidebars, toolbars, and editors are subordinate supports. Public sites share the same deliberate, credible foundation while retaining safe per-tenant theming.

**Key Characteristics:**

- Warm, confident, and precise rather than sterile or generic.
- Structured through tonal separation, borders, and low-key elevation.
- Yellow is an energetic signature, used with charcoal and neutral surfaces for balance.
- Clear hierarchy and purposeful interaction outweigh decoration.

## Colors

The platform uses BakerRang yellow as a concentrated signal of action and identity, grounded by charcoal navigation and quiet neutral work surfaces.

### Primary

- **BakerRang Yellow:** brand action, selected navigation, and identity accents.
- **Brand Ink:** dark text and iconography placed on the yellow action color.

### Neutral

- **Workshop Canvas:** the quiet application background that lets active content read first.
- **Paper Surface:** elevated work areas, fields, and cards.
- **Graphite Sidebar:** persistent workspace navigation and account context.
- **Measured Borders:** structural separation between adjacent layers and controls.
- **Purposeful Feedback:** success, warning, danger, and information colors are reserved for status rather than decoration.

### Named Rules

**The Yellow Signal Rule.** Use the BakerRang yellow to identify a primary action, active location, or brand moment—not as a broad surface treatment.

**The Canvas-First Rule.** Keep the main working canvas, especially the live website preview, visually dominant over supporting rails and controls.

## Typography

**Display Font:** Inter (with system sans-serif fallbacks)

**Body Font:** Inter (with system sans-serif fallbacks)

**Character:** A compact, highly legible sans-serif system supports scanning, form work, navigation, and business-site content without decorative type competition. Tenant sites may select from the renderer’s supported sans-serif and serif families while preserving readable contrast and structure.

### Hierarchy

- **Title:** Semibold, tight-leading headings establish page and section hierarchy.
- **Body:** Regular-weight, readable copy carries forms, descriptions, and operational detail.
- **Label:** Semibold text makes field labels and controls clear without relying on color alone.
- **Eyebrow:** Small, bold, uppercase tracked labels identify sections on public sites.

### Named Rules

**The Work-First Type Rule.** Use weight, scale, and spacing to establish hierarchy before introducing extra color, decoration, or type styles.

## Layout

The desktop Portal uses a persistent left workspace rail with a centered, constrained content column; mobile replaces it with a sticky compact header and focus-managed drawer. Main pages use a comfortable responsive gutter and preserve enough width for dense operational tasks without becoming edge-to-edge dashboards.

The public renderer uses tenant-configurable content widths, with a standard site container as the default. Public sections expand their vertical rhythm at the observed small-screen breakpoint, and mobile navigation collapses into a controlled menu rather than compressing desktop links.

**The Supporting-Rail Rule.** Navigation, inspectors, and toolbars should frame a task or canvas rather than become the visual destination themselves.

## Elevation & Depth

Depth is restrained and structural: white surfaces sit on a quiet workspace canvas, fine borders separate neighboring regions, and small shadows clarify interactive or raised elements. There is no decorative glassmorphism, stacked floating-card spectacle, or heavy visual effect language.

### Shadow Vocabulary

- **Low Lift:** the subtle shadow used on ordinary controls and cards to separate a functional surface from its background.
- **Focused Lift:** the deeper shadow reserved for transient or clearly elevated surfaces such as mobile navigation.

### Named Rules

**The Structural Elevation Rule.** Elevation must explain hierarchy, focus, or temporary priority; it must not be added as decoration.

## Shapes

The form language is gently rounded and compact. Controls use the medium radius, cards use the larger radius, and the public-site renderer translates a tenant’s safe corner choice into control and panel radii. Borders are visible, light, and purposeful; large decorative blobs, pill-everything treatments, and excessive clipping are outside the system.

## Components

### Buttons

- **Character:** Action controls are dependable, compact, and clearly differentiated.
- **Primary:** Yellow fill with dark ink, low lift, and a defined hover/active darkening sequence.
- **Secondary:** White structural surface with a stronger border for lower-priority actions.
- **Ghost:** Transparent by default, gaining only a muted surface on hover.
- **Danger:** Dedicated danger fill; do not repurpose yellow for destructive work.
- **Focus:** A visible blue focus outline with offset keeps keyboard navigation unmistakable.

### Badges

- **Style:** Small semibold status labels with a border and muted or semantic tonal background.
- **Use:** Status and feedback only; badges should not become decorative category confetti.

### Cards / Containers

- **Corner Style:** Large gentle corners.
- **Background:** Paper Surface over the Workshop Canvas.
- **Shadow Strategy:** Low Lift only.
- **Border:** Measured Borders define the container at rest.

### Inputs / Fields

- **Style:** Full-width white field, stronger border, compact internal padding, and a minimum comfortable touch height.
- **Focus:** Border shifts to the focus color and retains a visible offset outline.
- **Error / Disabled:** Error copy uses the dedicated danger foreground; disabled fields use a muted surface and reduced opacity without hiding their state.

### Navigation

- **Portal:** Graphite sidebar with muted links, high-contrast current text, and BakerRang Yellow for the active destination. The mobile drawer preserves the same hierarchy.
- **Public Site:** Sticky surface header, simple text navigation, and an optional primary CTA. Mobile navigation is explicit and controlled.

### Website Preview Canvas

The preview is an isolated, responsive viewport that renders the real shared site runtime. It is the primary visual object of the Website editor; surrounding controls exist to help users shape it, not to crowd it.

### Editor Canvas Guardrails

- The preview should occupy the majority of available editor space on desktop.
- Editing controls should feel like an inspector/workbench, not a second application
  beside the website.
- Avoid nesting every control in a separate card; use grouping, spacing, and subtle
  dividers where possible.
- Keep the top toolbar compact so it does not visually compete with the site.
- Selected-section treatments should be obvious but lightweight.
- Preview chrome should visually recede so the tenant website remains the focus.

## Do's and Don'ts

### Do:

- **Do** use yellow deliberately for the primary action, active navigation, and brand recognition.
- **Do** preserve visible borders, focus outlines, and semantic feedback states.
- **Do** give the active working surface enough space to read and act with confidence.
- **Do** keep tenant site themes safely scoped to their rendered sites.

### Don't:

- **Don't** turn the Portal into a conventional CRUD/admin console with controls competing against the work.
- **Don't** use glassmorphism, large ambient gradients, or heavy shadows as decoration.
- **Don't** let yellow become a default page background or substitute for semantic error/status color.
- **Don't** make public sites look like generic AI-generated landing pages.

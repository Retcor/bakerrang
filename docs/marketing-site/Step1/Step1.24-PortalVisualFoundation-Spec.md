# Planning Task — Step 1.24: Portal Visual Foundation

We are continuing development of the BakerRang reusable local-business marketing platform.

Do NOT implement anything. Produce a detailed implementation plan only.

## Goal

Transform the existing functional BakerRang Portal into the visual foundation of a polished SaaS product while preserving all existing functionality.

This step is about the Portal/admin application only. It is not a redesign of public tenant websites.

## Branding

The BakerRang brand uses the existing logo provided separately.

Visual direction is approved:

- polished SaaS experience
- light workspace with dark charcoal sidebar
- BakerRang yellow used selectively for primary actions, active states, focus states, and accents
- avoid overwhelming yellow surfaces
- rounded geometry should subtly reflect the logo
- clean, modern, professional rather than flashy
- thin neutral borders and restrained shadows
- strong visual hierarchy and consistent spacing

Approximate logo-derived colors:

- yellow: `#FEC51C`
- charcoal: `#292B2F`
- deep charcoal: `#1C1F29`

Treat these as starting points, not necessarily immutable raw values. Establish proper semantic design tokens.

## Branding behavior

Desktop:
- show BakerRang logo + `BakerRang` text where space allows

Constrained/collapsed layouts:
- icon-only logo is acceptable

The design must not sacrifice useful workspace merely to preserve the full wordmark.

## Mobile requirement

Mobile experience is a first-class requirement.

Do not create a desktop shell and merely hide pieces at smaller breakpoints.

Expected direction:

### Desktop
- persistent dark sidebar
- light application workspace
- clear navigation hierarchy
- comfortable page/content widths

### Tablet / constrained desktop
- sidebar may collapse if appropriate
- icon-only branding is acceptable

### Mobile
- no persistent desktop sidebar
- compact application header
- navigation available through a drawer/sheet/menu
- forms should adapt naturally to single-column layouts
- lists/tables must remain usable rather than simply overflowing
- primary actions must remain accessible
- do not rely on hover-only interaction
- touch targets should be appropriate

## Architecture constraints

Current workspace:

- `platform/apps/portal`
- `platform/apps/site-renderer`
- `platform/packages/ui`
- `platform/packages/site-components`
- `platform/packages/site-schema`

Prefer reusable Portal primitives in `platform/packages/ui` where appropriate.

Do not introduce a large third-party component framework unless there is a compelling reason.

Do not alter backend APIs or application behavior merely for styling.

Preserve existing:
- authentication
- business management
- site editing
- publishing
- leads
- media
- custom domains
- other current Portal functionality

Do not redesign the public site renderer in this step.

## Desired Step 1.24 scope

Please inspect the current Portal and shared UI package and plan a staged implementation covering roughly:

### 1.24.1 Design-system foundation
- semantic color tokens
- typography
- spacing
- border radii
- shadows
- focus states
- responsive/breakpoint strategy
- application background/surface hierarchy

### 1.24.2 Core UI primitives
Review what already exists before proposing new components.

Likely areas:
- Button
- Input
- Textarea
- Select if currently needed
- Card / panel
- Badge / status indicator
- Dialog / confirmation UI
- form labels/help/error presentation
- loading states
- empty states
- table/list presentation
- navigation primitives

Avoid creating components that have no immediate use.

### 1.24.3 Portal application shell
- desktop sidebar
- mobile header/navigation drawer
- BakerRang branding
- account/logout placement
- tenant/business context where appropriate
- responsive content container
- page heading/action conventions

### 1.24.4 Existing screen migration
Identify all current Portal routes/screens and provide a sensible migration order.

The purpose is to make existing functionality visually coherent, not rewrite it unnecessarily.

Likely areas include:
- business list/create
- business/site management
- leads inbox/detail/workflow
- media
- website editors
- custom domains

### 1.24.5 Responsive/mobile pass
Explicitly identify places in the existing Portal likely to break or feel poor on mobile:
- tables
- dense action rows
- forms
- section editors
- domain instructions
- lead views
- navigation

Recommend concrete responsive patterns for each.

### 1.24.6 Accessibility and interaction baseline
Include reasonable foundational requirements:
- visible keyboard focus
- semantic controls
- form labels
- contrast
- touch-target sizing
- reduced reliance on color alone for status
- keyboard-accessible navigation/dialogs where relevant

Do not turn this into a separate large accessibility project.

### 1.24.7 Verification
Include:
- deterministic tests that should be added or updated
- lint/typecheck/build expectations
- manual desktop verification
- manual mobile-width verification
- checks that existing functionality remains intact

## Important scope exclusions

Do NOT include these in Step 1.24:

- public renderer redesign
- tenant theme controls
- custom CSS
- working-site preview
- new About / FAQ / Business Hours / Social sections
- new arbitrary pages
- drag-and-drop site builder
- new backend functionality
- production deployment work

Those belong to later roadmap steps.

## Output requested

Produce:

1. Current-state findings from the existing code
2. Proposed design-system architecture
3. Proposed responsive application-shell architecture
4. Exact files/components likely to be created or modified
5. A staged implementation sequence
6. Risks/regressions to watch for
7. Testing and verification plan
8. Any decisions that genuinely require human input

Favor incremental refactoring over a large rewrite.
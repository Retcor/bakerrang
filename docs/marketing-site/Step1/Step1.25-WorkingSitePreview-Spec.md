# Planning Task — Step 1.25: Working-Site Preview

We are continuing the BakerRang multi-tenant marketing platform.

Do NOT implement anything. Produce a detailed implementation plan only.

## Goal

Add a safe Portal-driven preview experience so an authenticated operator can see
the tenant's current WORKING site before publishing it.

This is not a visual site builder.

The user should be able to:

1. edit working site content in the Portal
2. click Preview
3. see what the working site currently looks like
4. return to editing
5. publish only when satisfied

Published/customer-facing content must remain isolated from working preview content.

## Existing architecture constraints

The platform already has:

- separate working and published site state
- Portal at `platform/apps/portal`
- renderer at `platform/apps/site-renderer`
- Express API in `server/`
- shared site schema/components packages
- stable DEV origins:
    - `https://portal-dev.bakerrang.com`
    - `https://api-dev.bakerrang.com`
    - `https://sites-dev.bakerrang.com`
- custom domains always render PUBLISHED content
- shared published site route:
    - `/site/{tenantId}`
- deployed DEV runs:
    - `NODE_ENV=production`
    - `ALLOW_DRAFT_PUBLIC_SITES=false`

Historically, draft/public preview behavior existed behind development-only behavior,
but deployed DEV intentionally does not expose DRAFT sites publicly.

Do not weaken that production-style safety boundary simply to create preview.

## Security requirement

Preview must not create a publicly guessable route that exposes unpublished customer
content.

The plan must explicitly address authorization.

Preferred direction:

- preview should require an authenticated Portal/operator context OR
- use a short-lived server-issued preview authorization/token

Do not rely on tenantId alone as authorization.

Do not make `ALLOW_DRAFT_PUBLIC_SITES=true` in deployed DEV.

Custom domains must never show working content.

## UX direction

From the Website workspace, provide a clear action such as:

`Preview changes`

The preview should:

- render the WORKING site
- clearly display `Preview — not published`
- make it obvious that the user is not viewing the live site
- support desktop and mobile viewing
- ideally open in a separate tab/window initially so editing state remains intact

Do not implement inline editing or drag-and-drop.

If useful, the Portal may later add desktop/mobile preview framing, but keep Step 1.25
focused.

## Architecture questions to answer

Inspect the current implementation and determine:

1. How working site definitions are currently fetched.
2. Whether an authenticated working-site API already exists that can safely be reused.
3. Whether the renderer can securely retrieve working content without exposing a public
   draft endpoint.
4. Whether a signed/short-lived preview token is preferable to sharing Portal session
   cookies with the renderer.
5. How preview authorization should expire/revoke.
6. How the renderer distinguishes:
    - shared published route
    - custom-domain published route
    - preview route
7. How canonical/robots/SEO should behave in Preview.
8. Whether preview should load external assets/media exactly like published content.
9. Whether preview should use working branding/profile/theme data as those features expand.

## Required preview behavior

Preview must:

- use WORKING site state
- never change the published snapshot
- never require publishing
- never redirect to an active custom domain
- always be `noindex`
- not emit a canonical URL that could be treated as public content
- preserve normal lead-form safety

Consider whether lead submission should be disabled entirely in preview.
My preference is that preview forms should visually render but must NOT create real leads.

## Portal requirements

Add a clear Preview action within the Website workspace.

The plan should determine:

- button placement relative to Publish/Republish
- behavior when the site has never been published
- behavior when no working site exists
- behavior after edits
- what happens if preview authorization expires while the preview tab is open

## Renderer requirements

The public renderer must remain the rendering engine.

Do not create a separate duplicate renderer in the Portal.

Reuse the same site-components/rendering path so Preview accurately represents what will
be published.

Preview-specific chrome/banner may wrap the normal rendered site.

## Testing

Plan deterministic coverage for:

- unauthorized preview request rejected
- authorized preview returns working content
- published route still returns published content
- custom domain still returns published content
- preview never redirects to custom domain
- preview is noindex
- preview does not create leads
- expired/invalid preview authorization rejected
- tenant isolation

Also include manual DEV verification.

## Scope exclusions

Do NOT include:

- theme controls
- custom CSS
- About
- FAQ
- Business Hours
- Social Links
- arbitrary pages
- drag-and-drop editing
- inline editing
- production deployment

Those are later steps.

## Output

Return:

1. Current-state findings
2. Recommended preview authorization architecture
3. Request/data flow diagram
4. API changes required
5. Renderer changes required
6. Portal changes required
7. Exact files likely modified/created
8. Security considerations
9. Testing plan
10. Incremental implementation sequence
11. Any human decisions genuinely required

Prefer the smallest secure architecture that reuses the existing renderer and
working/published model.
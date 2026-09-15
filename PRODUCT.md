# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners and operators who want to build and manage a website for their business.

## Product Purpose

BakerRang is a platform of practical applications built to solve real problems with
focused, approachable software.

Its website platform helps business owners and operators create, manage, preview,
and publish professional business websites without requiring technical expertise.

The current product direction is to make the website platform feel like a polished
visual website builder rather than a traditional administration interface.

## Positioning

The platform pairs an authenticated business-management Portal with a shared public site renderer: operators maintain a working site, preview it, and publish a finished website.

## Operating Context

The product contains multiple applications with distinct purposes and designs. The website platform consists of the Portal for authenticated business, website, domain, and lead management, and the public multi-tenant site renderer.

## Capabilities and Constraints

- Website edits operate on a working copy; publishing creates the public snapshot.
- The editor may maintain an unsaved local draft above the working copy, but local
  changes do not persist until explicitly saved.
- The Portal accesses site data through the API; the public renderer consumes
  sanitized API data and does not connect directly to Firestore.
- Public sites, Portal previews, and future template previews use the same shared
  site-rendering runtime.
- Website previews are isolated from Portal chrome so tenant styling cannot affect
  the application interface.
- Save and Publish are deliberately separate actions.
- The live website preview should become the primary working surface of the editor.
- Product work is currently focused on turning the Portal and site renderer into a
  polished visual website-building experience.

## Brand Commitments

- Keep the BakerRang name.
- Future platform UI should feel like a finished product for people building business websites, rather than generic AI-generated interface or site output.
- Different BakerRang applications may use different designs appropriate to their purpose.

## Evidence on Hand

- [README.md](README.md) documents the platform architecture and its working-copy, preview, and publish flow.
- The existing Portal and public renderer live under `platform/apps/portal` and `platform/apps/site-renderer`.
- No external testimonials, customer claims, benchmarks, or pricing evidence are confirmed for use.

## Product Principles

- Treat business operators and public-site visitors as separate audiences with separate needs.
- Preserve a clear working-copy, preview, and publish lifecycle.
- Let each application have a design suited to its use rather than imposing one universal interface style.
- Prefer credible, deliberate product experiences over generic AI aesthetics.


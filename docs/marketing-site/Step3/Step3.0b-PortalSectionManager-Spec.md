# Step 3.0b Planning — Portal Section Manager

Planning/read-only only.

Do NOT modify files.
Do NOT deploy.
Do NOT mutate Firestore.
Do NOT mutate GCP.
Do NOT modify Git state.
Do NOT create commits.

Step 3.0a is COMPLETE, deployed, transitioned, and manually verified.

The section-instance architecture is now authoritative.

Step 3.0b should build the actual Portal Section Manager UX on top of that
foundation.

This is primarily a PRODUCT/PORTAL step.

Do NOT redesign the Step 3.0a backend architecture unless you discover a
genuine implementation defect.

---

# Current authoritative section architecture

Every section is now an instance:

{
id: string,
type: SectionType,
hidden: boolean,
content: SectionContent
}

Section IDs:

- opaque
- server-generated randomUUID()
- stable for the life of the section
- never inferred from type

Multiplicity:

Singleton:
- hero
- contact
- businessHours

Multiple allowed:
- about
- services
- gallery
- testimonials
- faq

Hero:

- exactly one
- first
- visible
- cannot move
- cannot remove
- cannot duplicate
- cannot hide

BusinessHours remains a projection of businessProfile.businessHours.

Working/published behavior:

- Portal edits WORKING
- Preview reads WORKING
- live renderer reads PUBLISHED
- Publish snapshots working state

All section mutations are ID-targeted and transactional.

Available backend commands/routes now support:

- add section
- remove section
- move section
- duplicate section
- hide/show
- update section content

Do NOT reintroduce type-as-identity.

---

# Step 3.0b product goal

Turn the current Homepage editing UX into a genuine section manager.

The operator should be able to see the page structure at a glance and directly
manage section instances.

Target experience:

Homepage Sections
────────────────────────────────────────────

[ Hero ]
Main headline & CTA
Visible
[Edit]   Pinned

[ Gallery ]
6 images
Visible
↑  ↓  [Edit]  [⋮]

[ Gallery ]
3 images
Hidden
↑  ↓  [Edit]  [⋮]

[ Services ]
4 services
Visible
↑  ↓  [Edit]  [⋮]

                  + Add Section

The operator should be able to:

- view all sections in current order
- clearly identify section type
- see a useful summary
- see visible/hidden state
- edit the exact section instance
- move up/down
- duplicate allowed sections
- hide/show
- remove
- add new sections
- continue using Preview and Publish naturally

This should feel materially better than the current collection of fixed editor
panes.

---

# Out of scope

Do NOT include:

- drag-and-drop
- theme/color/font controls
- new section types
- multi-page support
- header/navigation/footer editing
- SEO controls
- templates
- revision history
- live WYSIWYG iframe editing
- customer onboarding
- signup
- billing
- backend schema redesign

Do not add large page-builder libraries.

---

# 1. Audit the current Portal after 3.0a

Inspect the actual current implementation.

Identify:

- BusinessWebsite structure
- WebsiteEditorNavigation
- websiteEditors registry
- ActiveWebsiteEditor
- SectionCompositionEditor
- existing Overview pane
- every section editor
- Portal site API helpers
- dirty-navigation guard
- loading/error patterns
- existing dialog/menu/UI primitives

Explain exactly how the temporary 3.0a bridge works today.

Especially identify:

- fixed Homepage editor nav entries that should disappear or change
- how section editors currently discover sole instances
- what happens when multiple instances exist
- where the current Manage Sections pane lives
- what should be retired by 3.0b

---

# 2. Recommend the new Homepage information architecture

The Section Manager should become the PRIMARY Homepage editing surface.

Determine how the left-side/editor navigation should change.

Strongly consider:

Website
Overview
Homepage
Branding
Theme
Business Profile
Business Hours
Social Profiles
Custom CSS

rather than:

Homepage
Hero
About
Services
Gallery
Testimonials
FAQ
Contact
Manage Sections

The old fixed "one editor per type" navigation no longer matches the new
instance architecture.

Recommend the cleanest UX.

Do not preserve fixed type panes merely because they already exist.

---

# 3. Homepage Section Manager component structure

Design the Portal component structure.

Determine whether:

SectionCompositionEditor

should:

A. become the full Section Manager

or

B. be replaced/renamed by a dedicated component such as:

HomepageSectionManager

Prefer clear naming if the old component's responsibility has materially changed.

Recommend component boundaries for:

- section list
- section card
- add-section chooser
- section action menu
- summaries
- selected-section editor state

Avoid needless component fragmentation.

---

# 4. Section card design

Each card should communicate enough information without becoming a mini-preview.

Determine what every card displays:

Required:

- human-readable section type
- instance summary
- visible/hidden status
- Edit
- Move Up
- Move Down

For non-Hero sections:

- action menu containing appropriate actions

Possible structure:

Gallery
6 images
Visible

[↑] [↓] [Edit] [⋮]

Kebab actions:

Duplicate
Hide
Delete

or:

Show
Delete

depending on state.

Hero should clearly display:

Pinned

and should not expose invalid actions.

Recommend exact visual hierarchy and button placement.

Keep mobile-first behavior in mind.

---

# 5. Section summaries

Design useful summaries for each existing section type.

Do not show raw JSON or generic "Configured".

Examples:

Hero:
"Main headline & CTA"

About:
heading text, perhaps truncated

Services:
"4 services"

Gallery:
"6 images"

Testimonials:
"3 testimonials"

FAQ:
"8 questions"

Business Hours:
"Business hours"

Contact:
"Lead form"
or
"Email contact"

Inspect actual content shapes and recommend summaries based on real fields.

Requirements:

- cheap to derive client-side
- no extra backend request
- gracefully handles empty/default content
- truncate long text sensibly

Produce a table:

Type
Summary rule
Empty/default fallback

---

# 6. Add Section flow

Design the complete Portal flow using the existing Step 3.0a backend.

Target:

+ Add Section
  → chooser
  → choose type
  → mutation persists
  → returned SiteDefinition updates parent state
  → newly created section opens for editing

Determine:

- dialog vs popover/menu
- whether section descriptions should appear
- singleton types omitted vs shown disabled
- how businessHours should appear given its projection semantics
- loading state
- API error state
- focus behavior after creation
- whether chooser remains open after error

Do not create section IDs client-side.

Do not duplicate server-side default-content logic in Portal.

---

# 7. Edit exact instance

This is one of the most important changes in 3.0b.

The current temporary bridge relies on "sole instance of this type".

Remove that limitation.

Clicking Edit on:

Gallery A

must edit Gallery A.

Clicking Edit on:

Gallery B

must edit Gallery B.

Design how selected section identity flows through:

Section Manager
→ BusinessWebsite
→ ActiveWebsiteEditor
→ specific editor
→ save API

Recommend whether the editor receives:

sectionId

or:

resolved section object

and explain why.

Server save MUST remain sectionId-targeted.

The temporary ambiguity message introduced in 3.0a should become unnecessary and
be removed once explicit selection exists.

---

# 8. Editor presentation

Determine the best presentation for an active section editor.

Options:

A. manager disappears and editor replaces it
B. editor appears below the manager
C. editor opens alongside manager
D. editor opens in a drawer
E. route-level editing

Strong preference:

Do not introduce a complex drawer/layout system unless it materially improves UX.

Consider a simple flow:

Homepage
→ Section Manager
→ click Edit
→ section editor
→ Back to Homepage Sections

This may be better than trying to display everything simultaneously.

Audit current layout and recommend the smallest polished approach.

---

# 9. Navigation and dirty-state behavior

The Portal already has unsaved-edit navigation protection.

Preserve it.

Analyze:

- manager → editor
- editor → manager
- editor → another website pane
- browser navigation
- clicking Edit on a different card while current editor is dirty
- clicking Add while an editor is dirty

The dirty guard must not regress.

Do not silently discard edits.

Recommend exactly where selection/navigation state should live.

---

# 10. Move Up / Move Down

Use existing targeted backend move command.

Portal requirements:

- move exact section instance
- preserve parent state from returned SiteDefinition
- disable Up when movement is not allowed
- disable Down when movement is not allowed
- Hero has no move controls or clearly disabled controls
- account for Hero being pinned first
- hidden sections participate normally
- duplicate same-type instances behave normally
- loading state prevents double mutation
- error leaves current ordering intact

Analyze whether controls should be:

always visible

or:

inside action menu

Strong preference is always-visible because reorder is a primary composition
action and naturally accessible.

---

# 11. Duplicate

Use existing duplicate command.

Allowed:

about
services
gallery
testimonials
faq

Forbidden:

hero
contact
businessHours

Portal behavior:

- unavailable or omitted for forbidden types
- mutation persists immediately
- duplicate appears immediately after source
- returned SiteDefinition updates state
- strongly consider automatically opening the NEW duplicate for editing

Recommend whether automatic edit-after-duplicate improves workflow.

The new section ID must come from the server response.

Do not infer it from array ordering unless the API makes the identity clearly
available.

If the current API response only returns SiteDefinition and makes identifying the
new duplicate awkward, determine the safest way to identify it without backend
redesign if possible.

If a tiny response-shape improvement would clearly help, flag it explicitly.

---

# 12. Hide / Show

Use existing visibility command.

UX:

Visible section:
menu says Hide

Hidden section:
badge clearly says Hidden
menu says Show

Requirements:

- update immediately from returned SiteDefinition
- hidden card remains in manager
- hidden card remains editable
- hidden card retains normal ordering
- Preview omits hidden section
- live site remains unchanged until Publish
- Hero cannot hide

Consider whether Hidden cards should be visually subdued.

Do not rely on color alone.

---

# 13. Delete

Use existing remove command.

Requirements:

- Hero cannot delete
- confirmation required
- confirmation names the section type/context
- duplicate types must be distinguishable enough to avoid deleting the wrong one
- operation loading state
- delete exact section ID
- update manager from returned SiteDefinition
- choose sensible focus after deletion
- if deleting currently selected editor instance, return to manager

Determine wording.

Example:

Delete Gallery section?

This removes this section from the working site.
Uploaded media will remain in the Media Library.
The published site will not change until you publish.

That explanation may be valuable because media survives.

Recommend concise final copy.

---

# 14. Business Hours UX

BusinessHours is special.

It projects:

businessProfile.businessHours

Do not let the new manager create misleading behavior.

Determine:

- whether "+ Add Section" should show "Business Hours"
- what happens when selected
- whether it calls the existing projection-enable behavior
- what Edit opens
- what Delete does
- whether Hide is allowed
- whether its summary can indicate configured hours
- how absence of businessProfile hours is handled

Avoid duplicating business-hours settings into the section editor.

---

# 15. Contact UX

Contact remains singleton.

Determine:

- Add Contact availability when absent
- Edit Contact
- Hide Contact
- Delete Contact
- how Hero CTA implications should be explained, if at all

Do not add "primary contact" concepts.

No backend redesign unless a real bug exists.

---

# 16. Preview / Publish UX

Keep existing Preview architecture.

Do NOT add an iframe/WYSIWYG builder.

But audit whether the Section Manager should make existing actions easier to find.

Determine whether:

Preview changes
Publish

should remain where they are today or become more prominent while managing
sections.

Requirements:

- Preview reflects working section order/visibility/duplicates
- Publish remains explicit
- manager clearly distinguishes edits from live state if current Portal already
  supports that signal
- do not invent autosave/publish

Composition commands already persist WORKING immediately; clarify UX terminology
so "saved" does not imply "live".

---

# 17. Addability rules

The Add chooser must derive its allowed state from current composition.

Rules:

Hero:
never addable because required one already exists

Contact:
addable only if absent

BusinessHours:
addable only if absent and domain prerequisites allow

About:
always addable

Services:
always addable

Gallery:
always addable

Testimonials:
always addable

FAQ:
always addable

Determine whether these rules should be:

A. hard-coded in Portal from shared section metadata
B. returned by backend
C. inferred from schema/current composition

Prefer a small shared metadata/registry model if useful, but do not create a
large configuration framework.

Backend remains authoritative even if Portal filters choices.

---

# 18. Section metadata / registry

The Portal currently has type-specific editor registrations.

Evaluate whether 3.0b should introduce/refactor toward a section metadata registry
containing things such as:

type
displayName
summary builder
editor component
duplicable
singleton
icon

Potential conceptual structure:

const sectionDefinitions = {
gallery: {
label: 'Gallery',
editor: GalleryEditor,
duplicable: true,
...
}
}

But be careful:

Do NOT duplicate backend validation policy unnecessarily.

The backend is authoritative for multiplicity and command validity.

Portal metadata should support UX, not become a second business-rule engine.

Recommend a pragmatic boundary.

---

# 19. Existing WebsiteEditorNavigation cleanup

Identify exactly which current nav entries should be removed or retained.

Strong preference:

Homepage section TYPES should no longer be top-level navigation items.

Instead:

Homepage
→ Section Manager
→ exact instance editor

Site-wide settings remain separate:

Branding
Theme
Business Profile
Business Hours
Social Profiles
Custom CSS

But Business Hours appears both as site-level profile configuration and optional
Homepage projection, so inspect the current model and recommend wording that does
not confuse these concepts.

Produce the proposed final editor navigation tree.

---

# 20. Existing Overview cleanup

Audit the current Overview.

Determine whether:

- Homepage card should open Section Manager
- redundant "Manage Sections" concepts should disappear
- current section counts/status can be reused
- Preview/Publish cards/actions remain useful

Do not overbuild an analytics dashboard.

---

# 21. Loading / mutation state

Multiple actions exist per card.

Design a robust but simple pending model.

Examples:

move Gallery A
hide Services B
duplicate FAQ C
delete About D

Determine whether:

- one global section mutation at a time is sufficient
- per-card mutation state is better
- optimistic UI should be used

Strong preference:

Use server response as authoritative state.

Avoid optimistic reordering if it creates rollback complexity.

Prevent double-click/double-submit.

---

# 22. Error handling

Use existing Portal error conventions.

Plan for:

- stale section ID
- singleton conflict
- invalid move
- server 400/409
- network error
- concurrent edit resulting in returned fresh state
- section deleted in another tab

Errors should be understandable to the operator.

Do not expose raw 5xx internals.

Determine whether manager should refetch after certain conflict/stale errors.

---

# 23. Accessibility

Make accessibility explicit.

Requirements:

- Add Section button keyboard accessible
- chooser keyboard accessible
- Edit accessible
- Move Up / Move Down accessible names include section context
- disabled boundaries represented correctly
- kebab menu keyboard navigable
- visible/hidden state textual
- confirmation dialog focus handling
- focus returns sensibly after delete/duplicate/add
- no functionality requires drag/drop
- action icons must have labels/tooltips as appropriate

If duplicate same-type cards have identical labels, accessible names should include
enough context/order to distinguish them.

Example:

"Move Gallery 2 up"

or use the card's summary where useful.

---

# 24. Responsive/mobile behavior

This editor must work well on narrow screens.

Audit current Portal responsive patterns.

Determine:

- card layout at mobile width
- action wrapping
- move buttons placement
- Edit prominence
- menu placement
- Add chooser behavior

No hover-dependent interaction.

Avoid huge tables.

Prefer stacked cards.

---

# 25. Tests

Design deterministic Portal-focused tests.

At minimum:

Section Manager:

- renders current sections in order
- Hero shows pinned state
- Hero cannot move/hide/delete/duplicate
- duplicate same-type cards render independently
- summaries correct
- hidden badge shown
- Add chooser filters singleton-exhausted types
- Add persists and opens correct new instance
- Edit targets exact section ID
- two Galleries: edit second sends second ID
- Move Up sends exact ID/direction
- Move Down sends exact ID/direction
- boundary controls disabled
- duplicate sends exact source ID
- returned duplicate becomes visible in manager
- Hide/Show targets exact ID
- delete confirmation targets exact ID
- media-retention copy appears in delete confirmation if adopted
- server errors surfaced
- double-click protection
- dirty editor guard preserved
- keyboard accessibility for action menu/dialog

Existing editors:

- receive explicit section instance
- no `.find(type)` ambiguity path remains where explicit manager selection exists
- save sends exact ID

BusinessHours:

- projection enable/edit/remove semantics remain correct

Integration:

- parent SiteDefinition state updates from mutation responses
- manager reflects new order/state without full reload
- Preview still works

Do not add fragile screenshot tests unless the project already uses them.

---

# 26. Backend changes

Step 3.0a backend is considered complete.

Strong preference:

NO backend changes in 3.0b.

If the Portal needs a tiny API response improvement to reliably identify a newly
added/duplicated section, identify it.

Do NOT redesign command routes.

Any backend change must be narrowly justified by a concrete Portal need.

---

# 27. No regression to media safety

Even though 3.0b is Portal-focused, verify the UI calls only the Step 3.0a
instance APIs.

Do not:

- replace whole sections array client-side
- introduce type-targeted mutations
- bypass instance routes
- mutate media as a side effect of section deletion

Deleting a section removes references only.

Uploaded media stays in Media Library.

---

# 28. Future Step 3 implications

3.0b should leave a good foundation for:

3.1 Theme / Global Styling
3.2 Expanded Section Library
3.3 Multi-Page Sites

But do NOT implement them now.

Important future-friendly decisions:

- Section Manager should render from actual section instances, not a fixed type list
- Add chooser should be data/registry-driven enough that adding a new section type
  in 3.2 is straightforward
- selection state should conceptually support page+section identity later
- do not hardwire manager layout exclusively to the eight current types

Avoid premature generic page-builder infrastructure.

---

# 29. Implementation slices

Determine whether 3.0b should be one implementation slice or two.

Likely:

3.0b1
- navigation restructuring
- Section Manager
- exact-instance editing
- add/move/hide/duplicate/delete

3.0b2
- responsive/accessibility polish
- cleanup temporary 3.0a bridge
- tests

But if this is cohesive enough for one Codex implementation pass, recommend one.

We do not need artificial roadmap fragmentation.

---

# 30. Baseline health

Run local deterministic checks.

At minimum:

- server tests if backend behavior is inspected
- Portal tests
- platform typecheck
- platform lint
- renderer tests if Portal changes touch shared packages

No deployment.
No cloud/data mutation.

Report baseline.

---

# 31. Output

Return:

1. current post-3.0a Portal architecture
2. temporary bridge behavior that 3.0b should retire
3. recommended final Website navigation tree
4. Section Manager component architecture
5. section-card UX
6. section summary rules table
7. Add flow
8. Edit exact-instance flow
9. editor presentation/navigation flow
10. dirty-state handling
11. reorder UX
12. duplication UX
13. hide/show UX
14. delete UX + recommended confirmation copy
15. BusinessHours UX
16. Contact UX
17. Preview/Publish placement
18. addability/metadata strategy
19. Overview cleanup
20. loading/error model
21. accessibility plan
22. responsive/mobile plan
23. backend changes required, if any
24. deterministic test plan
25. files likely to change
26. recommended implementation slicing
27. baseline tests/results
28. blockers
29. whether Step 3.0b is ready to implement

No implementation.
No deployment.
No Firestore mutation.
No GCP mutation.
No commits.
# Step 3.0 Planning — Site Editor V2 / Section Architecture

Planning/read-only only.

Do NOT modify files.
Do NOT deploy.
Do NOT mutate Firestore.
Do NOT mutate GCP.
Do NOT modify GitHub settings.
Do NOT create commits.

This is the beginning of:

# PHASE 3 — Advanced Site Builder

Phase 2 is complete.

Step 3.0 is intentionally allowed to make breaking changes to the
MARKETING-SITE TEST data model where doing so establishes a substantially
better long-term architecture before real customer sites exist.

The purpose is NOT merely to add some section-management buttons.

The purpose is to establish the durable section-instance/composition
architecture that the more advanced BakerRang editor will build upon, and then
design the first genuinely capable section-management UX using that architecture.

---

# Current project context

BakerRang is a reusable multi-tenant local-business website platform.

Monorepo:

server/
Node/Express backend
Firestore
media/GCS

client/
legacy BakerRang React/Vite app

platform/
apps/portal
apps/site-renderer
packages/ui
packages/site-components
packages/site-schema

Current infrastructure/operations are mature and OUT OF SCOPE.

Phase 2 completed:

- MAIN production environment
- selective CI/CD
- rollback / verification hardening
- favicon/site-icon support
- lead deletion
- race-safe media deletion

Do not redesign those systems.

---

# IMPORTANT — Compatibility posture

There are currently NO real customer marketing sites whose persisted site schema
must be preserved.

Existing marketing-site tenants/sites are test data and may be deleted,
reset, reseeded, or migrated.

Therefore:

DO NOT optimize Step 3.0 around backward compatibility with existing test-site
document shapes.

DO NOT introduce permanent compatibility/normalization machinery solely to
support old marketing-site test data.

If the cleanest long-term section-management model requires a breaking change to
the marketing-site schema, recommend it.

Examples of changes that are acceptable if architecturally justified:

- adding mandatory stable section instance IDs
- changing section identity away from type-based lookup
- allowing multiple instances of the same section type
- restructuring composition metadata
- changing visibility representation
- replacing type-specific mutation helpers with instance-ID-based operations
- resetting/reseeding existing marketing-site test documents

Prefer the clean model we want BEFORE real customers exist.

However:

The MAIN GCP/Firestore project ALSO contains real data belonging to legacy
BakerRang applications, including password/vault and other existing app data.

That data is NOT disposable.

Any reset, seed, migration, or cleanup recommendation must be narrowly scoped to
the marketing-site tenant/site collections.

Never recommend:

- clearing Firestore broadly
- recreating the Firestore database
- deleting unrelated collections
- project-wide destructive migration

Treat only the marketing-site test data as disposable.

---

# Existing site architecture

Important architectural invariant:

`Home.sections` is currently the composition/source-of-truth for the Home page.

Inspect actual schema/source rather than assuming this exact structure remains
the best long-term model.

Existing section types currently include things such as:

- hero
- services
- about
- gallery
- contact / CTA

Inspect actual code and report the real set.

Working and published site states already exist.

Operators edit WORKING state.

Publishing snapshots working content into PUBLISHED state.

Renderer consumes published state in normal live traffic.

Preserve the WORKING/PUBLISHED behavioral model unless there is an extremely
strong architectural reason not to.

---

# Strategic product goal

Step 3.0 should establish the foundation for a real site builder.

The current editing experience behaves more like a collection of independent
forms.

We want a composition-driven editor where an operator can clearly see and
manipulate the page's ordered section instances.

Desired eventual Step 3.0 capabilities:

- view all current sections in page order
- add sections
- remove sections
- reorder sections
- duplicate sections
- hide/show sections without deleting content
- enter/edit a specific section easily
- clearly distinguish section type/title/state
- support multiple section instances where product semantics allow
- preserve working/published behavior
- retain media deletion/write-race safety
- remain responsive/mobile usable

This should feel like the foundation of a real CMS/site builder.

---

# Strong schema-design preference

Because we are deliberately still pre-customer, Step 3.0 is the right time to
establish a durable section-instance model.

Strongly evaluate a model conceptually like:

{
id: "...",
type: "gallery",
hidden: false,
content: { ... }
}

Do not preserve type-as-identity assumptions merely for compatibility.

Specifically investigate and, if appropriate, eliminate patterns such as:

findHomeSectionByType("gallery")

when future composition should support:

gallery instance A
gallery instance B

Determine which section types are genuinely singleton by PRODUCT semantics,
rather than because the current implementation happens to assume one.

If no type truly needs to be singleton, prefer allowing multiple instances.

If Hero or another type should remain singleton, justify that based on product
behavior, rendering, or editing semantics.

---

# Test-data migration/reset strategy

If Step 3.0 adopts a breaking marketing-site schema:

recommend the simplest transition.

Preferred options, in order:

1. reset/recreate existing marketing-site test sites manually
2. small narrowly-scoped test-data reset/seed script
3. one-time narrowly-scoped migration

Do NOT build permanent backward-compatibility code if resetting test sites is
simpler.

Clearly identify exactly which Firestore paths would be affected.

No migration/reset should execute during planning or implementation unless
explicitly approved by the operator.

---

# Scope constraints

DO NOT include:

- theme/color/font editing
- new section types unless strictly required for infrastructure/testing
- multi-page support
- navigation editor
- header/footer editor
- SEO controls
- templates/presets
- published revision history
- drag-and-drop unless there is a compelling reason

Strong preference:

Implement reliable section movement first with explicit controls such as:

Move Up
Move Down

Drag/drop can come later.

Do not introduce a large DnD dependency just for polish.

---

# 1. Audit current Home editor

Inspect the actual Portal implementation.

Identify:

- current Home/site editor entry point
- how section editors are rendered
- how current section order is represented
- whether every current section is always present
- whether optional sections already exist
- how mutations are submitted
- how editor state refreshes
- how preview works
- current loading/error patterns

List relevant files.

Explain what currently prevents the editor from functioning like a section manager.

---

# 2. Audit the current section schema

Inspect:

platform/packages/site-schema

and all related:

- server/site service code
- renderer code
- site-components
- Portal editor code

Document the actual section model:

- section discriminant/type
- IDs, if any
- content shape
- ordering
- visibility state if any
- uniqueness assumptions
- renderer assumptions
- editor assumptions
- corruption handling

This question is especially important:

Can the current architecture support:

hero
services
gallery
gallery
contact

or does code assume exactly one instance per section type?

Find every meaningful type-as-identity assumption.

---

# 3. Recommend the long-term section model

Design the clean section-instance model we should use before real customers exist.

At minimum analyze:

- stable section `id`
- section `type`
- visibility representation
- content payload
- ordering by array position
- optional metadata useful for editing
- whether section-level versioning metadata is needed now
- whether the model should remain Home-specific or be future-compatible with
  multi-page composition without prematurely implementing pages

Prefer a minimal durable model.

Do not add fields simply because they might be useful someday.

Example only:

type SiteSection = {
id: string
type: SectionType
hidden: boolean
content: SectionContent
}

The actual recommendation should come from the codebase.

---

# 4. Section identity

Determine whether section instances currently have stable IDs.

If they do:
- explain how generated
- explain how used
- determine whether they are good enough for long-term composition

If they do not:
- recommend a durable ID strategy

Consider:

- duplicate section types
- React keys
- edit-by-instance
- server mutation targeting
- reorder
- delete
- visibility
- future templates
- future published revision history
- future multi-page editing

Recommend:

- ID format
- where IDs are generated
- whether client or server owns generation
- how IDs are validated
- whether IDs are ever reused

Strong preference:

server-generated or trusted application-generated opaque IDs,
not type-derived IDs.

---

# 5. Section-type uniqueness / singleton rules

For each existing section type determine whether multiple instances should be:

- allowed
- forbidden
- technically possible but product-inappropriate

Produce a table:

Section type
Current assumption
Recommended multiplicity
Reason

Do not treat current implementation limitations as product rules.

Examples:

Hero
Services
About
Gallery
Contact

But inspect the actual section types first.

If all types can reasonably duplicate, say so.

If Hero should be singleton, justify why.

---

# 6. Section duplication

Analyze whether duplication should be included in Step 3.0.

A duplicate operation should:

- create a distinct section instance
- deep-copy editable content
- create a new section ID
- preserve referenced media IDs rather than duplicate media objects
- preserve or reset visibility appropriately
- not mutate the original
- obey any singleton constraints

Determine whether duplicate should insert:

- immediately after source
- at end
- another position

Prefer immediately after source unless code/product suggests otherwise.

If duplication requires fixing type-as-identity assumptions, that is acceptable in Step 3.0.

Do not defer duplication solely to preserve test data compatibility.

---

# 7. Add Section

Design the Add Section flow.

Questions:

- which section types are addable?
- how singleton types are handled
- what default content a new instance receives
- who owns defaults:
  schema?
  server?
  portal?
- where the new section is inserted
- whether add immediately persists
- whether the editor opens after add

Prefer simple UX:

+ Add Section
  → choose type
  → append or insert
  → persist working state
  → open/select the new section for editing

Inspect current patterns before deciding.

Default content should ideally live in a shared/domain-appropriate location, not
be duplicated across Portal and server.

---

# 8. Remove Section

Determine correct semantics.

Removing a section should:

- affect WORKING only
- leave PUBLISHED unchanged until publish
- remove only the section reference/content
- NOT delete referenced media objects
- preserve media library objects
- require deliberate confirmation

Questions:

- are any section types mandatory?
- can Hero be removed?
- can all sections be removed?
- does renderer tolerate an empty composition?
- should a page require at least one section?
- should delete be blocked for singleton-required sections?

Prefer confirmation over a full undo system unless undo is extremely cheap.

---

# 9. Hide / Show

Design a reversible visibility model that does NOT delete content.

Strongly evaluate:

hidden: boolean

versus:

visible: boolean

Because backward compatibility is no longer the primary concern, choose based on
clean long-term semantics rather than missing-field compatibility.

Clarify:

- hidden section remains in composition/order
- hidden section remains editable
- hidden section is omitted by renderer
- hidden state is snapshotted during publish
- preview reflects hidden state
- editor still shows hidden section clearly

Recommend one representation and explain why.

---

# 10. Reordering

Design Move Up / Move Down behavior first.

Must:

- change working section order only
- preserve exact section objects/content
- work at first/last boundaries
- work with hidden sections
- support duplicate section types
- publish in resulting order

Determine whether reorder should:

A. persist the entire reordered section array

or

B. invoke a targeted move operation by section ID

Given stable IDs and concurrency concerns, analyze which is safer.

Consider multi-tab edits.

Prefer transaction-safe targeted mutation if practical.

Avoid silent lost updates.

---

# 11. Backend mutation architecture

Inspect:

server/services/siteService.js
server/routes/tenants.js
related mutation helpers

Determine the clean long-term mutation model.

Potential operations:

- addSection
- removeSection
- moveSection
- duplicateSection
- setSectionVisibility

or a smaller set of validated instance-based composition commands.

Strong preference:

Do NOT create one unrestricted "replace arbitrary sections[]" endpoint.

Also avoid five nearly-identical endpoints if a clean command abstraction fits.

Recommend the right shape.

Possible conceptual API:

POST /site/pages/home/sections
POST /site/pages/home/sections/:sectionId/duplicate
DELETE /site/pages/home/sections/:sectionId
PATCH /site/pages/home/sections/:sectionId/visibility
POST /site/pages/home/sections/:sectionId/move

But do not assume REST shape until after inspecting current route conventions.

All mutations must:

- be tenant scoped
- use established auth
- operate on WORKING state
- leave PUBLISHED unchanged
- be transactional where necessary
- preserve media validation/race safety
- reject malformed IDs/types
- preserve section order integrity

---

# 12. Generic future page compatibility

Step 3.0 only needs Home.

However, Step 3.3 will eventually introduce multi-page sites.

Do not unnecessarily deepen Home-specific concepts if a small abstraction can
later support:

pageId
→ sections[]

Examples of things to avoid:

moveHomeGalleryUp()

Prefer concepts like:

moveSection(pageId, sectionId, direction)

ONLY if this does not prematurely require implementing multi-page storage now.

Find the correct balance.

---

# 13. Media deletion interaction — LOAD-BEARING

Recent media deletion correctness depends on transactional site writes.

This is critical.

Audit every proposed Step 3.0 write against:

- `requireTenantMediaInTransaction`
- `mutateWorkingHome`
- media `PENDING` deletion state
- Firestore transaction conflicts
- working references
- published references

Scenarios:

duplicate Gallery
→ copied media IDs remain references and must not bypass media validation

add section with media defaults
→ media must be validated if any exist

edit section instance
→ must validate referenced media transactionally

remove section
→ removes references, should not delete media

reorder
→ should not add/remove references but must not create a new non-transactional
write path

hide/show
→ media remains referenced if hidden content still contains media

Important question:

Should hidden sections still count as media references for deletion protection?

Strong likely answer:
YES, because hidden content is retained and could be shown again.

Verify and state explicitly.

Do NOT create any path that reintroduces the save-vs-delete race.

---

# 14. Working / published behavior matrix

For each operation:

- add
- remove
- duplicate
- hide
- show
- move

state:

Working changes immediately?
Published changes immediately?
Preview changes?
Live Renderer changes before publish?
Publish behavior?

Expected:

working changes immediately
preview reflects working
published stays unchanged
live stays unchanged
publish snapshots final composition

Verify against actual code.

---

# 15. Portal UX design

Recommend the editor structure.

Target concept:

Home Page
------------------------------------------------

[ Hero ]
Main headline and CTA
Visible
[Edit] [...]

[ Services ]
4 services
Visible
[Edit] [...]

[ Gallery ]
6 images
Hidden
[Edit] [...]

[ Gallery ]
3 images
Visible
[Edit] [...]

            + Add Section

For each section card determine:

- section type label
- human-friendly summary
- visible/hidden state
- Edit
- Move Up
- Move Down
- Duplicate
- Hide/Show
- Delete

Determine whether actions belong:

- inline
- kebab menu
- combination

Keep mobile usability strong.

Do not overdesign.

---

# 16. Editing behavior

Determine what happens when Edit is clicked.

Options:

A. expand inline
B. navigate to a section-specific editor
C. drawer
D. modal
E. retain existing editor forms and wrap them in the new composition shell

Prefer the smallest change that substantially improves UX.

Do not rewrite every section editor unless the current architecture makes reuse impossible.

Section editing must target SECTION ID, not merely type, if duplicate types are allowed.

Find every existing editor that currently identifies its section by type.

---

# 17. Preview behavior

Inspect current preview architecture.

Determine:

- whether preview reads working state
- how section order is reflected
- whether hide/show naturally reflects
- whether duplicate sections naturally reflect
- whether refresh is required

Do NOT build a live WYSIWYG iframe editor in Step 3.0 unless something equivalent
already exists and is trivial to leverage.

Recommend only what is needed.

---

# 18. Renderer changes

Inspect site-renderer composition rendering.

Determine every change required to support:

- stable section IDs
- arbitrary order
- multiple same-type section instances
- hidden sections
- optional/missing section types
- empty composition if allowed

Look for:

- `find` by type
- object maps keyed by type
- assumptions of uniqueness
- React keys based on type
- metadata logic that assumes singleton sections

Identify all renderer/site-component assumptions Step 3.0 must fix.

---

# 19. Existing section editors and type-based lookup

Search entire repo for patterns such as:

find(section => section.type === ...)
findHomeSection(...)
isHeroSection(...)
isServicesSection(...)
type-based indexes/maps

Classify each occurrence:

- renderer
- editor
- service mutation
- validation
- tests
- helper

Determine which must be replaced with instance-ID targeting versus which can
legitimately remain type-based for type dispatch.

Important distinction:

TYPE DISPATCH is fine.

TYPE AS IDENTITY is not.

---

# 20. Schema validation

Design server/schema validation rules for the new model.

Consider:

- missing ID
- malformed ID
- duplicate ID within page
- unknown section type
- malformed content
- singleton violation if applicable
- invalid hidden value
- empty sections array
- max section count if needed
- duplicate references
- corrupt order

Do not add arbitrary limits without need.

Reject invalid writes cleanly.

Because test data is disposable, do not preserve invalid legacy shapes merely to
avoid reset.

---

# 21. Data reset / transition plan

If breaking schema changes are recommended, give the exact simplest transition.

Report:

- which Firestore paths hold marketing-site test data
- which documents would become incompatible
- whether resetting tenant site docs is sufficient
- whether media/leads need preservation
- whether tenant records themselves need reset
- whether published snapshots need deletion/recreation

Strong preference:

preserve media and leads if they remain structurally compatible,
reset only site composition/config if possible.

Absolutely avoid touching unrelated legacy BakerRang collections.

Recommend commands/scripts only conceptually during planning.

Do NOT execute.

---

# 22. Authorization

Use current site-edit authorization model.

Audit actual current requirements.

Do not redesign roles in Step 3.0.

All composition mutations should follow the same authorization model as current
site editing.

---

# 23. Concurrency model

Analyze multi-tab/concurrent mutation behavior.

Examples:

A.
Tab 1 moves section A
Tab 2 deletes section B

B.
Tab 1 duplicates gallery
Tab 2 edits same gallery

C.
media delete runs while duplicate/edit occurs

D.
two reorder operations race

Determine which operations can safely serialize through Firestore transactions.

Prefer section-ID-based transactions that read current composition and apply a
single command to the latest state.

Avoid stale client full-array replacement if it can overwrite unrelated concurrent edits.

Explain expected conflict/retry behavior.

---

# 24. Tests

Design deterministic coverage.

Backend/service:

- add section
- remove section
- move up
- move down
- first/last boundaries
- hide/show
- duplicate
- singleton enforcement if any
- stable IDs
- duplicate ID rejection
- invalid section ID
- tenant isolation
- published unchanged
- arbitrary section order
- duplicate section types
- media references preserved
- hidden media still protected from deletion
- race with media deletion
- concurrent composition mutation behavior

Portal:

- list order
- multiple same-type sections
- add flow
- delete confirmation
- hide/show
- move controls
- disabled boundaries
- duplicate
- edit correct instance
- loading
- error handling
- double-submit protection
- mobile-friendly menu/control behavior

Renderer:

- order preserved
- duplicate same-type sections render
- hidden omitted
- visible rendered
- stable React keys use instance IDs
- no singleton assumption where unsupported

Schema:

- ID required
- ID uniqueness
- type/content validation
- visibility validation

---

# 25. Accessibility

Explicitly account for keyboard/mobile interaction.

Move Up / Move Down controls are preferred partly because they are naturally
accessible.

Ensure:

- controls have accessible names
- kebab/menu actions keyboard reachable
- visible/hidden state conveyed textually
- focus returns sensibly after menu/dialog actions
- delete confirmation is accessible
- disabled boundary actions are clear
- no drag-only interaction

---

# 26. Future-proofing boundaries

Step 3.0 should establish the foundation for:

3.1 Theme / Global Styling
3.2 Expanded Section Library
3.3 Multi-Page Sites
3.4 Header / Navigation / Footer Editor
3.5 SEO / Social Sharing Controls
3.6 Templates / Site Presets
3.7 Published Site Revision History / Restore

Do NOT implement those now.

But identify design decisions in Step 3.0 that affect them.

Especially:

- section IDs should work with templates/revisions
- page composition should not prevent multi-page later
- section type dispatch should remain extensible
- editor should not hardcode a fixed section list
- visibility should work naturally with templates
- duplication should not duplicate media objects
- future revisions should be able to snapshot composition as-is

---

# 27. Recommended Step 3.0 scope

Based on actual code, decide whether Step 3.0 should include ALL of:

- stable section IDs
- instance-based mutations
- multiple instances
- add
- remove
- reorder
- duplicate
- hide/show
- editor shell
- renderer support

My preference is YES if the architecture supports doing this coherently.

Because test marketing-site data is disposable, do not defer foundational
changes solely because they are breaking.

However, be willing to split implementation into coherent slices.

---

# 28. Implementation slices

Recommend 2–3 implementation slices maximum.

Likely shape:

## 3.0a — Section Architecture Foundation

Potential scope:

- new section-instance schema
- stable IDs
- type-as-identity removal
- backend instance-based mutation model
- renderer support
- narrowly scoped test-data transition/reset plan
- media-race-safe composition writes

## 3.0b — Portal Section Manager

Potential scope:

- composition list
- add
- remove
- move up/down
- hide/show
- duplicate
- edit correct section instance
- responsive/accessibility behavior

## 3.0c — Integration / Polish

Only if genuinely needed:

- preview polish
- remaining editor conversions
- test-data reset execution/manual acceptance
- UX cleanup

But choose slices based on actual dependencies.

Do not create artificial slices if 3.0a/3.0b are enough.

---

# 29. Audit current branch health

Run LOCAL deterministic checks as appropriate.

At minimum:

- server tests
- platform tests
- platform typecheck
- client checks only if relevant
- workflow/classifier checks if relevant

Do not deploy.

Do not mutate cloud data.

Report baseline status before implementation.

---

# 30. Architecture-regression check

Because Step 3.0 is foundational, explicitly verify the plan will preserve:

- renderer does not directly access Firestore
- media stored as IDs, URLs hydrated
- tenant scoping
- working/published separation
- transaction-safe media writes
- no new broad CORS/auth exceptions
- no new infra coupling
- no dependency-heavy page-builder framework unless clearly justified

Do not introduce a generic external CMS/page-builder library.

This should remain BakerRang's own domain model/editor.

---

# 31. Output

Return:

1. current Home editor architecture
2. actual current section schema
3. all type-as-identity assumptions
4. recommended long-term section-instance schema
5. section ID strategy
6. section multiplicity/singleton table
7. add-section design
8. remove-section design
9. hide/show design
10. reorder design
11. duplication design
12. backend mutation architecture
13. concurrency model
14. media-deletion interaction
15. working/published behavior matrix
16. Portal editor UX recommendation
17. editing-instance targeting strategy
18. renderer changes
19. schema validation rules
20. test-data reset/transition plan
21. accessibility plan
22. deterministic test plan
23. future-proofing conclusions
24. recommended Step 3.0 scope
25. exact implementation slices
26. files likely to change
27. baseline tests/results
28. blockers
29. whether Step 3.0 is ready to implement

No implementation.
No deployment.
No cloud mutation.
No Firestore mutation.
No commits.
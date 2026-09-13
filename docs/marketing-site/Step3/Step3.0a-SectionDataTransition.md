# Step 3.0a section-data transition

Run this only after deploying Step 3.0a, and only for explicitly selected marketing-site test tenant IDs. The application does not run a migration or reset automatically.

For each selected `tenantId`:

1. Back up these two documents:
   - `tenants/{tenantId}/site/config/pages/home`
   - `tenants/{tenantId}/site/config/published/current`
2. Preserve `tenants/{tenantId}/site/config`. It contains branding, theme, custom CSS, and business-profile data and does not need a schema change.
3. Rewrite only `tenants/{tenantId}/site/config/pages/home.sections`:
   - retain the array order, section `type`, and `content` verbatim;
   - replace every section `id` with a newly generated UUID;
   - add `hidden: false` to every section;
   - verify there is exactly one visible Hero and that it is index 0;
   - verify Contact and Business Hours occur at most once.
4. Delete only `tenants/{tenantId}/site/config/published/current`. Do not publish the stale snapshot.
5. Open the Portal working preview and verify content, order, navigation, media, business hours, and the standalone Contact page.
6. Publish manually. This recreates `published/current` with the new IDs and required visibility state.

Custom CSS transition: old selectors such as `#about`, `#gallery`, and `#services` are no longer stable section selectors. Use the type-level hooks instead, for example `[data-br-section="about"]`, `[data-br-section="gallery"]`, and `[data-br-section="services"]` (and the equivalent hook for other types). The UUID-based `section-<uuid>` DOM IDs are instance anchors, not the preferred long-term Custom CSS API.

Do not delete or recreate `site/config`. Do not call site initialization for a tenant whose config remains present.

Preserve all of the following:

- `tenants/{tenantId}` and `tenants/{tenantId}/members/**`
- `tenants/{tenantId}/site/config`
- `tenants/{tenantId}/media/**`
- `tenants/{tenantId}/leads/**`
- every unrelated tenant and all non-marketing BakerRang collections, including vault/password, budget, WoW, and legacy application data

Never run this as a collection-wide or database-wide operation. The operator must supply and review the exact marketing-site test tenant ID allowlist before each run.

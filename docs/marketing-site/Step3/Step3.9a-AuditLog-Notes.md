# Step 3.9a audit-event retention

Operator audit events are append-only documents at
`tenants/{tenantId}/auditEvents/{eventId}` and have no TTL, count pruning, or
delete endpoint in this MVP.

Firestore does not cascade subcollections when a tenant document is removed.
The Step 3.10 tenant lifecycle/export work must therefore explicitly export and
delete `tenants/{tenantId}/auditEvents/*` as part of its tenant cleanup plan.

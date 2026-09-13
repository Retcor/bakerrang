const httpError = (status, message) => Object.assign(new Error(message), { status })

// This read is intentionally transaction-local. A preflight check is useful for
// fast feedback, but only a read in the committing transaction closes the race
// with a deletion authorization transition.
export const assertTenantActiveInTransaction = async (transaction, tenantRef) => {
  const snapshot = await transaction.get(tenantRef)
  if (!snapshot.exists) throw httpError(404, 'Tenant not found')
  if (snapshot.data()?.status !== 'ACTIVE') {
    throw httpError(409, 'Tenant is pending deletion')
  }
  return snapshot
}

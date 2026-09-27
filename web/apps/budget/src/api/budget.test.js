import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../providers.jsx'
import { BudgetApiError, createBill, loadPlan, updateBill } from './budget.js'

vi.mock('../providers.jsx', () => ({ apiClient: { request: vi.fn() } }))

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) })

beforeEach(() => apiClient.request.mockReset())

describe('Budget API client', () => {
  it('loads the plan with abort support and returns only a successful body', async () => {
    const plan = { paydays: [], bills: [] }; const controller = new AbortController()
    apiClient.request.mockResolvedValue(response(200, plan))
    await expect(loadPlan({ signal: controller.signal })).resolves.toEqual(plan)
    expect(apiClient.request).toHaveBeenCalledWith('/budget/plan', { signal: controller.signal })
  })

  it('throws a typed error carrying only the approved application fields', async () => {
    const current = { id: 'b', rev: 2 }; apiClient.request.mockResolvedValue(response(409, { error: 'Bill changed', code: 'conflict', field: 'expectedRev', current, limit: 250, privateExtra: 'drop' }))
    const error = await updateBill('b', { expectedRev: 1 }).catch((cause) => cause)
    expect(error).toBeInstanceOf(BudgetApiError)
    expect(error).toMatchObject({ status: 409, code: 'conflict', field: 'expectedRev', current, limit: 250 })
    expect(error.privateExtra).toBeUndefined()
  })

  it('sends financial data in the request body and safely encodes ids', async () => {
    apiClient.request.mockResolvedValue(response(201, { bill: { id: 'new' } }))
    const body = { name: 'Rent', amountCents: 145000 }
    await createBill(body)
    expect(apiClient.request).toHaveBeenLastCalledWith('/budget/bills', { method: 'POST', body, signal: undefined })
    apiClient.request.mockResolvedValue(response(200, { bill: { id: 'a/b' } }))
    await updateBill('a/b', { ...body, expectedRev: 1 })
    expect(apiClient.request.mock.calls.at(-1)[0]).toBe('/budget/bills/a%2Fb')
    expect(apiClient.request.mock.calls.at(-1)[0]).not.toContain('?')
  })
})

import { describe, expect, it } from 'vitest'
import { appendTurn, findTurn } from './turns.js'

describe('stable turn identity', () => {
  it('retains unique ids and monotonically increasing visible numbers through the 50-turn cap', () => {
    let turns = []
    for (let n = 1; n <= 64; n += 1) turns = appendTurn(turns, { id: `stable-${n}`, n, said: `translation ${n}` })
    expect(turns).toHaveLength(50)
    expect(new Set(turns.map((turn) => turn.id)).size).toBe(50)
    expect(turns.map((turn) => turn.n)).toEqual(Array.from({ length: 50 }, (_, index) => index + 15))
    expect(findTurn(turns, turns[10].id)?.said).toBe('translation 25')
    expect(findTurn(turns, 'stable-1')).toBeUndefined()
  })

  it('does not collapse duplicate spoken phrases into one turn', () => {
    const turns = appendTurn(appendTurn([], { id: 'one', n: 1, heard: 'same' }), { id: 'two', n: 2, heard: 'same' })
    expect(turns.map((turn) => turn.id)).toEqual(['one', 'two'])
  })
})

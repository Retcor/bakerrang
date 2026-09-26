import { describe, expect, it } from 'vitest'
import { handshapes, staticGestures } from './handshapes.js'
import { classifyFrame } from './classify.js'
import { createStabilizer } from './stabilizer.js'
import { createHold } from './hold.js'

describe('Sign recognizer contracts', () => {
  it('contains exactly the approved twenty one-hand targets', () => { expect(handshapes.map(shape => shape.id)).toEqual(['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'O', 'V', 'W', 'X', 'Y', 'Z', '1', '5', 'ILY']); expect(staticGestures).toHaveLength(18) })
  it('scales landmarks to real media dimensions before estimating', () => { const estimator = { estimate: points => { expect(points[0]).toEqual([1600, 600, 160]); return { gestures: [{ name: 'A', score: 9 }] } } }; expect(classifyFrame([{ x: 1, y: .5, z: .1 }], { width: 1600, height: 1200 }, estimator)).toBe('A') })
  it('commits static readings after 400ms and motion immediately', () => { const next = createStabilizer(); expect(next('L', 0)).toEqual({ reading: null, changed: false }); expect(next('L', 399).reading).toBe(null); expect(next('L', 400)).toEqual({ reading: 'L', changed: true }); expect(next('J', 401)).toEqual({ reading: 'J', changed: true }); expect(next('L', 900)).toEqual({ reading: 'J', changed: false }) })
  it('holds a static target once after 1.2 seconds', () => { const next = createHold(); expect(next('L', 'L', 0).progress).toBe(0); expect(next('L', 'L', 1200)).toMatchObject({ progress: 1, changed: true }); expect(next('L', 'L', 1300).changed).toBe(false) })
})

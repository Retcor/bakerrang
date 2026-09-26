import { Finger, FingerCurl, FingerDirection, GestureDescription } from 'fingerpose'

export const handshapes = Object.freeze([
  ['A', 'A', 'Letter A', 'Make a fist with your thumb resting against the side of your index finger.'],
  ['B', 'B', 'Letter B', 'Hold four fingers straight up and together, with your thumb folded across your palm.'],
  ['C', 'C', 'Letter C', 'Curve your fingers and thumb into a C shape.'],
  ['E', 'E', 'Letter E', 'Bend your fingertips down to rest on your thumb, tucked across your palm.'],
  ['F', 'F', 'Letter F', 'Touch your thumb and index fingertip in a circle, with the other three fingers up.'],
  ['G', 'G', 'Letter G', 'Point your index finger and thumb sideways, parallel, with the other fingers closed.'],
  ['H', 'H', 'Letter H', 'Point your index and middle fingers sideways together, with the others closed.'],
  ['I', 'I', 'Letter I', 'Raise your pinky, with the other fingers closed over your thumb.'],
  ['J', 'J', 'Letter J', 'Make an I, then draw a J in the air with your pinky.', true],
  ['K', 'K', 'Letter K', 'Raise your index and middle fingers in a V, with your thumb touching between them.'],
  ['L', 'L', 'Letter L', 'Raise your index finger and stick your thumb out to make an L.'],
  ['O', 'O', 'Letter O', 'Curve all your fingertips to meet your thumb in an O.'],
  ['V', 'V', 'Letter V', 'Raise your index and middle fingers apart in a V, with the others closed.'],
  ['W', 'W', 'Letter W', 'Raise your index, middle and ring fingers apart, with your thumb holding your pinky.'],
  ['X', 'X', 'Letter X', 'Hook your index finger, with the other fingers closed.'],
  ['Y', 'Y', 'Letter Y', 'Stretch out your thumb and pinky, with the middle three fingers closed.'],
  ['Z', 'Z', 'Letter Z', 'Draw a Z in the air with your index finger.', true],
  ['1', '1', 'Number 1', 'Raise your index finger, with the other fingers closed and your thumb over them.'],
  ['5', '5', 'Number 5', 'Spread all five fingers open.'],
  ['ILY', 'ILY', 'I love you', 'Stretch out your thumb, index finger and pinky, with the middle two fingers folded down.']
].map(([id, glyph, name, howTo, motion = false]) => Object.freeze({ id, glyph, name, howTo, motion })))

export const handshapeById = id => handshapes.find(shape => shape.id === id) || null

const closed = (description, fingers) => fingers.forEach(finger => description.addCurl(finger, FingerCurl.FullCurl, 1))
const straight = (description, fingers) => fingers.forEach(finger => { description.addCurl(finger, FingerCurl.NoCurl, 1); description.addDirection(finger, FingerDirection.VerticalUp, 1) })
const staticShape = (id, configure) => { const description = new GestureDescription(id); configure(description); return description }
const four = [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]

const shapes = {
  ILY: staticShape('ILY', d => { straight(d, [Finger.Thumb, Finger.Index, Finger.Pinky]); closed(d, [Finger.Middle, Finger.Ring]) }),
  5: staticShape('5', d => straight(d, [Finger.Thumb, ...four])),
  A: staticShape('A', d => { closed(d, four); d.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1) }),
  B: staticShape('B', d => { straight(d, four); d.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1) }),
  C: staticShape('C', d => { four.forEach(f => d.addCurl(f, FingerCurl.HalfCurl, 1)); d.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1) }),
  E: staticShape('E', d => { four.forEach(f => d.addCurl(f, FingerCurl.HalfCurl, 1)); d.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1) }),
  F: staticShape('F', d => { d.addCurl(Finger.Index, FingerCurl.FullCurl, 1); d.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1); straight(d, [Finger.Middle, Finger.Ring, Finger.Pinky]) }),
  G: staticShape('G', d => { [Finger.Index, Finger.Thumb].forEach(f => { d.addCurl(f, FingerCurl.NoCurl, 1); d.addDirection(f, FingerDirection.HorizontalLeft, 1); d.addDirection(f, FingerDirection.HorizontalRight, 1) }); closed(d, [Finger.Middle, Finger.Ring, Finger.Pinky]) }),
  H: staticShape('H', d => { [Finger.Index, Finger.Middle].forEach(f => { d.addCurl(f, FingerCurl.NoCurl, 1); d.addDirection(f, FingerDirection.HorizontalLeft, 1); d.addDirection(f, FingerDirection.HorizontalRight, 1) }); closed(d, [Finger.Thumb, Finger.Ring, Finger.Pinky]) }),
  I: staticShape('I', d => { straight(d, [Finger.Pinky]); closed(d, [Finger.Index, Finger.Middle, Finger.Ring]) }),
  K: staticShape('K', d => { straight(d, [Finger.Index, Finger.Middle, Finger.Thumb]); closed(d, [Finger.Ring, Finger.Pinky]) }),
  L: staticShape('L', d => { straight(d, [Finger.Index]); d.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1); d.addDirection(Finger.Thumb, FingerDirection.HorizontalLeft, 1); d.addDirection(Finger.Thumb, FingerDirection.HorizontalRight, 1); closed(d, [Finger.Middle, Finger.Ring, Finger.Pinky]) }),
  O: staticShape('O', d => { four.forEach(f => d.addCurl(f, FingerCurl.HalfCurl, 1)); d.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1) }),
  V: staticShape('V', d => { straight(d, [Finger.Index, Finger.Middle]); closed(d, [Finger.Thumb, Finger.Ring, Finger.Pinky]) }),
  W: staticShape('W', d => { straight(d, [Finger.Index, Finger.Middle, Finger.Ring]); closed(d, [Finger.Thumb, Finger.Pinky]) }),
  X: staticShape('X', d => { d.addCurl(Finger.Index, FingerCurl.HalfCurl, 1); closed(d, [Finger.Middle, Finger.Ring, Finger.Pinky]) }),
  Y: staticShape('Y', d => { straight(d, [Finger.Thumb, Finger.Pinky]); closed(d, [Finger.Index, Finger.Middle, Finger.Ring]) }),
  1: staticShape('1', d => { straight(d, [Finger.Index]); closed(d, [Finger.Middle, Finger.Ring, Finger.Pinky, Finger.Thumb]) })
}
export const staticGestures = Object.freeze(['ILY', '5', 'A', 'B', 'C', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'O', 'V', 'W', 'X', 'Y', '1'].map(id => shapes[id]))

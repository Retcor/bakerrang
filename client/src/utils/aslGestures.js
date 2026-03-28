import { GestureDescription, Finger, FingerCurl, FingerDirection } from 'fingerpose'

// ── Common signs ──────────────────────────────────────────────────────────

const iLoveYou = new GestureDescription('I Love You')
iLoveYou.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
iLoveYou.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0)
iLoveYou.addCurl(Finger.Middle, FingerCurl.FullCurl, 1.0)
iLoveYou.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0)
iLoveYou.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0)

const thumbsUp = new GestureDescription('ThumbsUp')
thumbsUp.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
thumbsUp.addDirection(Finger.Thumb, FingerDirection.VerticalUp, 1.0)
thumbsUp.addDirection(Finger.Thumb, FingerDirection.DiagonalUpLeft, 0.9)
thumbsUp.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 0.9)
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  thumbsUp.addCurl(f, FingerCurl.FullCurl, 1.0)
  thumbsUp.addCurl(f, FingerCurl.HalfCurl, 0.9)
}

const thumbsDown = new GestureDescription('ThumbsDown')
thumbsDown.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
thumbsDown.addDirection(Finger.Thumb, FingerDirection.VerticalDown, 1.0)
thumbsDown.addDirection(Finger.Thumb, FingerDirection.DiagonalDownLeft, 0.9)
thumbsDown.addDirection(Finger.Thumb, FingerDirection.DiagonalDownRight, 0.9)
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  thumbsDown.addCurl(f, FingerCurl.FullCurl, 1.0)
  thumbsDown.addCurl(f, FingerCurl.HalfCurl, 0.9)
}

const hello = new GestureDescription('Hello')
for (const f of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  hello.addCurl(f, FingerCurl.NoCurl, 1.0)
}

// ── ASL Alphabet (static) ─────────────────────────────────────────────────

// A — closed fist, thumb resting alongside index
const a = new GestureDescription('A')
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  a.addCurl(f, FingerCurl.FullCurl, 1.0)
}
a.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
a.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9)
a.addDirection(Finger.Thumb, FingerDirection.VerticalUp, 1.0)
a.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 0.9)
a.addDirection(Finger.Thumb, FingerDirection.DiagonalUpLeft, 0.9)

// B — four fingers straight up, thumb folded across palm
const b = new GestureDescription('B')
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  b.addCurl(f, FingerCurl.NoCurl, 1.0)
  b.addDirection(f, FingerDirection.VerticalUp, 1.0)
}
b.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1.0)
b.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9)

// C — all fingers half-curled forming a C shape
const c = new GestureDescription('C')
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  c.addCurl(f, FingerCurl.HalfCurl, 1.0)
  c.addDirection(f, FingerDirection.DiagonalUpRight, 0.9)
  c.addDirection(f, FingerDirection.DiagonalUpLeft, 0.9)
  c.addDirection(f, FingerDirection.VerticalUp, 0.8)
}
c.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
c.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9)

// E — all fingers bent toward palm (tips touch thumb)
const e = new GestureDescription('E')
for (const f of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  e.addCurl(f, FingerCurl.HalfCurl, 1.0)
  e.addCurl(f, FingerCurl.FullCurl, 0.8)
  e.addDirection(f, FingerDirection.HorizontalLeft, 0.9)
  e.addDirection(f, FingerDirection.HorizontalRight, 0.9)
  e.addDirection(f, FingerDirection.DiagonalUpRight, 0.7)
  e.addDirection(f, FingerDirection.DiagonalUpLeft, 0.7)
}
e.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0)
e.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9)

// F — index+thumb pinched into OK, other three fingers extended
const f = new GestureDescription('F')
f.addCurl(Finger.Index, FingerCurl.FullCurl, 1.0)
f.addCurl(Finger.Index, FingerCurl.HalfCurl, 0.9)
f.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0)
f.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9)
for (const finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  f.addCurl(finger, FingerCurl.NoCurl, 1.0)
  f.addDirection(finger, FingerDirection.VerticalUp, 1.0)
}

// G — index pointing horizontally, thumb also horizontal
const g = new GestureDescription('G')
g.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0)
g.addDirection(Finger.Index, FingerDirection.HorizontalLeft, 1.0)
g.addDirection(Finger.Index, FingerDirection.HorizontalRight, 1.0)
g.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
g.addDirection(Finger.Thumb, FingerDirection.HorizontalLeft, 0.9)
g.addDirection(Finger.Thumb, FingerDirection.HorizontalRight, 0.9)
for (const finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  g.addCurl(finger, FingerCurl.FullCurl, 1.0)
}

// H — index+middle both pointing horizontally
const h = new GestureDescription('H')
h.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0)
h.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0)
for (const finger of [Finger.Index, Finger.Middle]) {
  h.addDirection(finger, FingerDirection.HorizontalLeft, 1.0)
  h.addDirection(finger, FingerDirection.HorizontalRight, 1.0)
}
h.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0)
h.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0)
h.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1.0)
h.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9)

// I — pinky extended up, all others curled
const i = new GestureDescription('I')
i.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0)
i.addDirection(Finger.Pinky, FingerDirection.VerticalUp, 1.0)
i.addDirection(Finger.Pinky, FingerDirection.DiagonalUpLeft, 0.9)
i.addDirection(Finger.Pinky, FingerDirection.DiagonalUpRight, 0.9)
for (const finger of [Finger.Index, Finger.Middle, Finger.Ring]) {
  i.addCurl(finger, FingerCurl.FullCurl, 1.0)
}
i.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9)
i.addCurl(Finger.Thumb, FingerCurl.NoCurl, 0.8)

// K — index+middle extended with thumb between them pointing up
const k = new GestureDescription('K')
k.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0)
k.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0)
k.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
k.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0)
k.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0)
k.addDirection(Finger.Index, FingerDirection.DiagonalUpRight, 1.0)
k.addDirection(Finger.Index, FingerDirection.VerticalUp, 0.9)
k.addDirection(Finger.Middle, FingerDirection.DiagonalUpLeft, 0.9)
k.addDirection(Finger.Middle, FingerDirection.VerticalUp, 0.9)
k.addDirection(Finger.Thumb, FingerDirection.VerticalUp, 1.0)
k.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 0.9)

// L — index pointing up, thumb extended horizontally (L-shape)
const l = new GestureDescription('L')
l.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0)
l.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0)
l.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
l.addDirection(Finger.Thumb, FingerDirection.HorizontalLeft, 1.0)
l.addDirection(Finger.Thumb, FingerDirection.HorizontalRight, 1.0)
for (const finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  l.addCurl(finger, FingerCurl.FullCurl, 1.0)
}

// O — fingers and thumb curved to form an O
const o = new GestureDescription('O')
for (const finger of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  o.addCurl(finger, FingerCurl.HalfCurl, 1.0)
  o.addCurl(finger, FingerCurl.FullCurl, 0.9)
  o.addDirection(finger, FingerDirection.DiagonalUpRight, 0.9)
  o.addDirection(finger, FingerDirection.DiagonalUpLeft, 0.9)
}
o.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0)
o.addDirection(Finger.Thumb, FingerDirection.DiagonalUpRight, 0.9)
o.addDirection(Finger.Thumb, FingerDirection.DiagonalUpLeft, 0.9)

// V — index+middle up (victory/peace, also ASL V)
const v = new GestureDescription('V')
v.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0)
v.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0)
v.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0)
v.addDirection(Finger.Middle, FingerDirection.VerticalUp, 1.0)
v.addCurl(Finger.Ring, FingerCurl.FullCurl, 1.0)
v.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0)
v.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1.0)
v.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9)

// W — index+middle+ring up
const w = new GestureDescription('W')
for (const finger of [Finger.Index, Finger.Middle, Finger.Ring]) {
  w.addCurl(finger, FingerCurl.NoCurl, 1.0)
  w.addDirection(finger, FingerDirection.VerticalUp, 1.0)
}
w.addCurl(Finger.Pinky, FingerCurl.FullCurl, 1.0)
w.addCurl(Finger.Thumb, FingerCurl.FullCurl, 1.0)
w.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9)

// X — index finger hooked (half curl)
const x = new GestureDescription('X')
x.addCurl(Finger.Index, FingerCurl.HalfCurl, 1.0)
x.addDirection(Finger.Index, FingerDirection.VerticalUp, 0.9)
x.addDirection(Finger.Index, FingerDirection.DiagonalUpRight, 0.9)
x.addDirection(Finger.Index, FingerDirection.DiagonalUpLeft, 0.9)
for (const finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  x.addCurl(finger, FingerCurl.FullCurl, 1.0)
}
x.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.9)
x.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9)

// Y — thumb and pinky extended (shaka)
const y = new GestureDescription('Y')
y.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
y.addCurl(Finger.Pinky, FingerCurl.NoCurl, 1.0)
y.addDirection(Finger.Pinky, FingerDirection.VerticalUp, 1.0)
y.addDirection(Finger.Pinky, FingerDirection.DiagonalUpRight, 0.9)
for (const finger of [Finger.Index, Finger.Middle, Finger.Ring]) {
  y.addCurl(finger, FingerCurl.FullCurl, 1.0)
}

// 1 — index pointing up, thumb curled (distinct from L where thumb is out)
const one = new GestureDescription('1')
one.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0)
one.addDirection(Finger.Index, FingerDirection.VerticalUp, 1.0)
for (const finger of [Finger.Middle, Finger.Ring, Finger.Pinky]) {
  one.addCurl(finger, FingerCurl.FullCurl, 1.0)
}
one.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0)
one.addCurl(Finger.Thumb, FingerCurl.FullCurl, 0.9)

export const allGestures = [
  // Common signs first (higher priority in tie-breaking)
  iLoveYou, thumbsUp, thumbsDown, hello,
  // ASL alphabet
  a, b, c, e, f, g, h, i, k, l, o, v, w, x, y, one
]

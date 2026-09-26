export const createHold = ({ holdMs = 1200 } = {}) => {
  let target = null; let since = null; let held = false
  return (nextTarget, reading, nowMs, motion = false) => {
    if (nextTarget !== target) { target = nextTarget; since = null; held = false }
    if (!target || reading !== target) { since = null; held = false; return { progress: 0, held: false, changed: false } }
    if (since === null) since = nowMs
    const progress = motion ? 1 : Math.min(1, (nowMs - since) / holdMs)
    const changed = progress === 1 && !held
    held = held || progress === 1
    return { progress, held, changed }
  }
}

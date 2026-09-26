export const createStabilizer = ({ readMs = 400, clearMs = 600 } = {}) => {
  let reading = null; let candidate = null; let candidateSince = 0; let emptySince = null; let motionUntil = 0
  return (rawId, nowMs) => {
    const before = reading
    if (nowMs < motionUntil) return { reading, changed: false }
    if (rawId === 'J' || rawId === 'Z') { reading = rawId; candidate = rawId; motionUntil = nowMs + 1000; emptySince = null; return { reading, changed: before !== reading } }
    if (rawId) { emptySince = null; if (rawId !== candidate) { candidate = rawId; candidateSince = nowMs } if (candidate === rawId && nowMs - candidateSince >= readMs) reading = rawId } else { candidate = null; if (emptySince === null) emptySince = nowMs; if (nowMs - emptySince >= clearMs) reading = null }
    return { reading, changed: before !== reading }
  }
}

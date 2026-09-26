export const classifyFrame = (landmarks, { width, height }, estimator) => {
  if (!landmarks?.length || !width || !height) return null
  const points = landmarks.map(point => [point.x * width, point.y * height, point.z * width])
  const best = estimator.estimate(points, 8).gestures.sort((a, b) => b.score - a.score)[0]
  return best?.name || null
}

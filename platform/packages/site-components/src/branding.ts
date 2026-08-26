export function contrastColor (hexColor: string): '#ffffff' | '#111827' {
  const hex = /^#[0-9a-f]{6}$/i.test(hexColor) ? hexColor.slice(1) : 'ffffff'
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.0652
    ? '#ffffff'
    : '#111827'
}

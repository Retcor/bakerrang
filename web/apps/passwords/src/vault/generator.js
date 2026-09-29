export const PASSWORD_CLASSES = Object.freeze({
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digit: '0123456789',
  symbols: '!#$%&*+-=?@^_~'
})

const UINT32_SPACE = 2 ** 32

export const uniformIndex = (size, random = globalThis.crypto) => {
  const threshold = UINT32_SPACE - (UINT32_SPACE % size)
  const sample = new Uint32Array(1)
  for (;;) {
    random.getRandomValues(sample)
    if (sample[0] < threshold) return sample[0] % size
  }
}

export const generatePassword = ({ length = 20, symbols = true } = {}, random = globalThis.crypto) => {
  if (!Number.isInteger(length) || length < 12 || length > 64 || typeof symbols !== 'boolean') {
    throw new RangeError('Invalid password generator options')
  }
  const classes = [PASSWORD_CLASSES.lower, PASSWORD_CLASSES.upper, PASSWORD_CLASSES.digit]
  if (symbols) classes.push(PASSWORD_CLASSES.symbols)
  const alphabet = classes.join('')
  for (;;) {
    let candidate = ''
    for (let i = 0; i < length; i++) candidate += alphabet[uniformIndex(alphabet.length, random)]
    if (classes.every((group) => [...candidate].some((character) => group.includes(character)))) return candidate
  }
}

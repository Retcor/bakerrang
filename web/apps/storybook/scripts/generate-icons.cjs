const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('../../../../platform/node_modules/sharp')

const appRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(appRoot, '../../..')
const sourcePath = path.join(repoRoot, 'web/.impeccable/mocks/storybook-icon.svg')
const logoPath = path.join(repoRoot, 'client/src/assets/bakerrang-logo.png')
const publicPath = path.join(appRoot, 'public')

const icoFromPng = (png) => {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(32, 6)
  header.writeUInt8(32, 7)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(header.length, 18)
  return Buffer.concat([header, png])
}

const run = async () => {
  const [source, logo] = await Promise.all([fs.readFile(sourcePath, 'utf8'), fs.readFile(logoPath)])
  const embedded = source.replaceAll('bakerrang-logo.png', `data:image/png;base64,${logo.toString('base64')}`)
  await fs.mkdir(publicPath, { recursive: true })

  const targets = [
    [512, 'android-chrome-512x512.png'],
    [192, 'android-chrome-192x192.png'],
    [180, 'apple-touch-icon.png'],
    [32, 'favicon-32x32.png'],
    [16, 'favicon-16x16.png']
  ]
  for (const [size, name] of targets) {
    await sharp(Buffer.from(embedded)).resize(size, size).png().toFile(path.join(publicPath, name))
  }
  const favicon = await fs.readFile(path.join(publicPath, 'favicon-32x32.png'))
  await fs.writeFile(path.join(publicPath, 'favicon.ico'), icoFromPng(favicon))
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

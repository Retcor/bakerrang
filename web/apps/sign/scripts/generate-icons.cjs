const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('../../../../platform/node_modules/sharp')
const appRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(appRoot, '../../..')
const ico = png => { const h = Buffer.alloc(22); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4); h.writeUInt8(32, 6); h.writeUInt8(32, 7); h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12); h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18); return Buffer.concat([h, png]) }
async function run () { const [svg, logo] = await Promise.all([fs.readFile(path.join(repoRoot, 'web/.impeccable/mocks/sign-icon.svg'), 'utf8'), fs.readFile(path.join(repoRoot, 'client/src/assets/bakerrang-logo.png'))]); const source = svg.replaceAll('bakerrang-logo.png', `data:image/png;base64,${logo.toString('base64')}`); const pub = path.join(appRoot, 'public'); await fs.mkdir(pub, { recursive: true }); for (const [size, name] of [[512, 'android-chrome-512x512.png'], [192, 'android-chrome-192x192.png'], [180, 'apple-touch-icon.png'], [32, 'favicon-32x32.png'], [16, 'favicon-16x16.png']]) await fs.writeFile(path.join(pub, name), await sharp(Buffer.from(source)).resize(size, size).png().toBuffer()); await fs.writeFile(path.join(pub, 'favicon.ico'), ico(await sharp(Buffer.from(source)).resize(32, 32).png().toBuffer())) }
run().catch(error => { console.error(error); process.exitCode = 1 })

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const https = require('node:https')
const path = require('node:path')

const appRoot = path.resolve(__dirname, '..')
const lock = require(path.join(appRoot, 'vendor.lock.json'))
const vendorRoot = path.join(appRoot, 'public', 'vendor')
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex')

const readIfValid = async (file, expected) => {
  try {
    const data = await fs.readFile(file)
    return data.length === expected.bytes && sha256(data) === expected.sha256
  } catch { return false }
}

const download = url => new Promise((resolve, reject) => {
  https.get(url, response => {
    if (response.statusCode !== 200) return reject(new Error(`Model download failed: HTTP ${response.statusCode}`))
    const chunks = []
    response.on('data', chunk => chunks.push(chunk))
    response.on('end', () => resolve(Buffer.concat(chunks)))
  }).on('error', reject)
})

async function run () {
  const runtimeSource = path.join(appRoot, '..', '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
  const runtimeDestination = path.join(vendorRoot, `tasks-vision-${lock.tasksVision.version}`)
  await fs.mkdir(runtimeDestination, { recursive: true })
  for (const file of lock.tasksVision.files) await fs.copyFile(path.join(runtimeSource, file), path.join(runtimeDestination, file))
  const modelDestination = path.join(vendorRoot, lock.model.file)
  if (await readIfValid(modelDestination, lock.model)) return
  const model = await download(lock.model.url)
  if (model.length !== lock.model.bytes || sha256(model) !== lock.model.sha256) throw new Error('Downloaded hand model did not match vendor.lock.json')
  await fs.writeFile(modelDestination, model)
}

run().catch(error => { console.error(error.message); process.exitCode = 1 })

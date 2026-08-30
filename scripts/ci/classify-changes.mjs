import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BOTH_PLATFORM_SERVICES = ['portal', 'renderer']

// This is the single repository-path policy used by CI and future deployment
// workflows. Keep CI-only inputs distinct from deploy/build inputs.
const PATH_RULES = [
  { prefix: 'server/', ci: ['api'], deploy: ['api'] },
  { prefix: 'client/', ci: ['client'], deploy: ['client'] },
  { prefix: 'platform/apps/portal/', ci: ['portal'], deploy: ['portal'] },
  { prefix: 'platform/apps/site-renderer/', ci: ['renderer'], deploy: ['renderer'] },
  { prefix: 'platform/packages/site-schema/', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { prefix: 'platform/packages/ui/', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { prefix: 'platform/packages/site-components/', ci: ['renderer'], deploy: ['renderer'] },

  { exact: 'platform/package.json', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/package-lock.json', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/.dockerignore', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/scripts/config-validation.mjs', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/tsconfig.base.json', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/scripts/config-validation.d.mts', ci: BOTH_PLATFORM_SERVICES, deploy: [] },
  { exact: 'platform/eslint.config.mjs', ci: BOTH_PLATFORM_SERVICES, deploy: [] },
  { exact: 'platform/.gitignore', ci: [], deploy: [] },
  { exact: 'platform/.nvmrc', ci: [], deploy: [] },

  // Known repository areas outside service CI and deployment.
  { prefix: 'docs/', ci: [], deploy: [] },
  { prefix: 'extension/', ci: [], deploy: [] },
  { prefix: 'addon/', ci: [], deploy: [] },
  { prefix: '.github/', ci: [], deploy: [] },
  { prefix: '.claude/', ci: [], deploy: [] },
  { prefix: '.codex/', ci: [], deploy: [] },
  { prefix: 'scripts/ci/', ci: [], deploy: [] },
  // Historical tombstone: deleted-path and stale ranges must remain classifiable.
  { exact: 'scripts/deploy-dev.ps1', ci: [], deploy: [] },
  { exact: 'firestore.indexes.json', ci: [], deploy: [] },
  { exact: 'firebase.json', ci: [], deploy: [] },
  { exact: '.firebaserc', ci: [], deploy: [] },
  { exact: '.gitignore', ci: [], deploy: [] },
  { test: repositoryPath => !repositoryPath.includes('/') && repositoryPath.toLowerCase().endsWith('.md'), ci: [], deploy: [] }
]

const normalizePath = repositoryPath => repositoryPath.replaceAll('\\', '/').replace(/^\.\//, '')

const matches = (rule, repositoryPath) =>
  (rule.exact && repositoryPath === rule.exact) ||
  (rule.prefix && repositoryPath.startsWith(rule.prefix)) ||
  (rule.test && rule.test(repositoryPath))

export function classifyPath (repositoryPath) {
  const normalized = normalizePath(repositoryPath)
  const rule = PATH_RULES.find(candidate => matches(candidate, normalized))
  return rule ? { path: normalized, ci: [...rule.ci], deploy: [...rule.deploy] } : null
}

export function classifyChanges (repositoryPaths) {
  const ci = new Set()
  const deploy = new Set()
  const unknown = []

  for (const repositoryPath of new Set(repositoryPaths.map(normalizePath).filter(Boolean))) {
    const classification = classifyPath(repositoryPath)
    if (!classification) {
      unknown.push(repositoryPath)
      continue
    }
    classification.ci.forEach(service => ci.add(service))
    classification.deploy.forEach(service => deploy.add(service))
  }

  return {
    ci: {
      api: ci.has('api'),
      portal: ci.has('portal'),
      renderer: ci.has('renderer'),
      client: ci.has('client')
    },
    deploy: {
      api: deploy.has('api'),
      portal: deploy.has('portal'),
      renderer: deploy.has('renderer'),
      client: deploy.has('client')
    },
    unknown: unknown.sort()
  }
}

function readChangedPaths (inputPath) {
  const input = fs.readFileSync(inputPath)
  if (input.includes(0)) return input.toString().split('\0').filter(Boolean)
  return input.toString().split(/\r?\n/).filter(Boolean)
}

function writeGitHubOutputs (outputPath, result) {
  const outputs = {
    api: result.ci.api,
    portal: result.ci.portal,
    renderer: result.ci.renderer,
    client: result.ci.client,
    deploy_api: result.deploy.api,
    deploy_portal: result.deploy.portal,
    deploy_renderer: result.deploy.renderer,
    deploy_client: result.deploy.client
  }
  fs.appendFileSync(outputPath, Object.entries(outputs).map(([name, value]) => `${name}=${value}\n`).join(''))
}

function runCli () {
  const args = process.argv.slice(2)
  const inputIndex = args.indexOf('--input')
  const outputIndex = args.indexOf('--github-output')
  const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : null
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null

  if (!inputPath) throw new Error('Usage: node classify-changes.mjs --input <changed-files> [--github-output <path>]')

  const result = classifyChanges(readChangedPaths(inputPath))
  console.log(JSON.stringify(result, null, 2))

  if (result.unknown.length) {
    for (const repositoryPath of result.unknown) {
      console.error(`Unclassified repository path:\n${repositoryPath}\n\nUpdate the CI/CD impact map before merging.`)
    }
    process.exitCode = 1
    return
  }

  if (outputPath) writeGitHubOutputs(outputPath, result)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

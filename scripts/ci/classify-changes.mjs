import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ALL_WEB_SERVICES = ['web-launcher', 'web-storybook', 'web-polyglot', 'web-sign', 'web-budget', 'web-passwords', 'web-account']

// This is the single repository-path policy used by CI and future deployment
// workflows. Keep CI-only inputs distinct from deploy/build inputs.
const PATH_RULES = [
  { prefix: 'server/', ci: ['api'], deploy: ['api'] },
  { prefix: 'web/apps/launcher/', ci: ['web-launcher'], deploy: ['web-launcher'] },
  { prefix: 'web/apps/storybook/', ci: ['web-storybook'], deploy: ['web-storybook'] },
  { prefix: 'web/apps/polyglot/', ci: ['web-polyglot'], deploy: ['web-polyglot'] },
  { prefix: 'web/apps/sign/', ci: ['web-sign'], deploy: ['web-sign'] },
  { prefix: 'web/apps/budget/', ci: ['web-budget'], deploy: ['web-budget'] },
  { prefix: 'web/apps/passwords/', ci: ['web-passwords'], deploy: ['web-passwords'] },
  { prefix: 'web/apps/account/', ci: ['web-account'], deploy: ['web-account'] },
  { prefix: 'web/packages/', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },

  { exact: 'web/package.json', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/package-lock.json', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/Dockerfile', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/.dockerignore', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/eslint.config.js', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/vitest.config.js', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/nginx/apps/launcher.conf', ci: ['web-launcher'], deploy: ['web-launcher'] },
  { exact: 'web/nginx/apps/passwords.conf', ci: ['web-passwords'], deploy: ['web-passwords'] },
  { exact: 'web/nginx/apps/account.conf', ci: ['web-account'], deploy: ['web-account'] },
  { prefix: 'web/nginx/', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { prefix: 'web/.impeccable/', ci: [], deploy: [] },
  { exact: 'web/PRODUCT.md', ci: [], deploy: [] },
  { exact: 'web/DESIGN.md', ci: [], deploy: [] },
  { exact: 'web/README.md', ci: [], deploy: [] },
  { exact: 'web/AGENTS.md', ci: [], deploy: [] },
  { exact: 'web/CLAUDE.md', ci: [], deploy: [] },
  { exact: 'web/.gitignore', ci: [], deploy: [] },
  { exact: 'web/.nvmrc', ci: [], deploy: [] },
  // Brand masters (the canonical logo); each app ships its own copies.
  { prefix: 'web/brand/', ci: [], deploy: [] },

  // Known repository areas outside service CI and deployment.
  { prefix: 'docs/', ci: [], deploy: [] },
  { prefix: '.github/', ci: [], deploy: [] },
  { prefix: '.claude/', ci: [], deploy: [] },
  { prefix: '.codex/', ci: [], deploy: [] },
  { prefix: 'scripts/ci/', ci: [], deploy: [] },
  { exact: 'scripts/verify-live.ps1', ci: [], deploy: [] },
  { prefix: '.impeccable/', ci: [], deploy: [] },
  { prefix: '.agents/', ci: [], deploy: [] },
  // Historical tombstones: deleted paths (and stale ranges that still contain
  // them) must remain classifiable, but never trigger CI or a deploy.
  { exact: 'scripts/deploy-dev.ps1', ci: [], deploy: [] },
  { prefix: 'client/', ci: [], deploy: [] },
  { prefix: 'platform/', ci: [], deploy: [] },
  { prefix: 'extension/', ci: [], deploy: [] },
  { prefix: 'addon/', ci: [], deploy: [] },
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
      'web-launcher': ci.has('web-launcher'),
      'web-storybook': ci.has('web-storybook'),
      'web-polyglot': ci.has('web-polyglot'),
      'web-sign': ci.has('web-sign'),
      'web-budget': ci.has('web-budget'),
      'web-passwords': ci.has('web-passwords'),
      'web-account': ci.has('web-account')
    },
    deploy: {
      api: deploy.has('api'),
      'web-launcher': deploy.has('web-launcher'),
      'web-storybook': deploy.has('web-storybook'),
      'web-polyglot': deploy.has('web-polyglot'),
      'web-sign': deploy.has('web-sign'),
      'web-budget': deploy.has('web-budget'),
      'web-passwords': deploy.has('web-passwords'),
      'web-account': deploy.has('web-account')
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
    web_launcher: result.ci['web-launcher'],
    web_storybook: result.ci['web-storybook'],
    web_polyglot: result.ci['web-polyglot'],
    web_sign: result.ci['web-sign'],
    web_budget: result.ci['web-budget'],
    web_passwords: result.ci['web-passwords'],
    web_account: result.ci['web-account'],
    deploy_api: result.deploy.api,
    deploy_web_launcher: result.deploy['web-launcher'],
    deploy_web_storybook: result.deploy['web-storybook'],
    deploy_web_polyglot: result.deploy['web-polyglot'],
    deploy_web_sign: result.deploy['web-sign'],
    deploy_web_budget: result.deploy['web-budget'],
    deploy_web_passwords: result.deploy['web-passwords'],
    deploy_web_account: result.deploy['web-account']
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

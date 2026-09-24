import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BOTH_PLATFORM_SERVICES = ['portal', 'renderer']
const ALL_WEB_SERVICES = ['web-launcher', 'web-storybook']

// This is the single repository-path policy used by CI and future deployment
// workflows. Keep CI-only inputs distinct from deploy/build inputs.
const PATH_RULES = [
  { prefix: 'server/', ci: ['api'], deploy: ['api'] },
  { prefix: 'client/', ci: ['client'], deploy: ['client'] },
  { prefix: 'platform/apps/portal/', ci: ['portal'], deploy: ['portal'] },
  { prefix: 'platform/apps/site-renderer/', ci: ['renderer'], deploy: ['renderer'] },
  { prefix: 'platform/packages/site-schema/', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { prefix: 'platform/packages/ui/', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { prefix: 'platform/packages/site-components/', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { prefix: 'platform/packages/site-runtime/', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { prefix: 'web/apps/launcher/', ci: ['web-launcher'], deploy: ['web-launcher'] },
  { prefix: 'web/apps/storybook/', ci: ['web-storybook'], deploy: ['web-storybook'] },
  { prefix: 'web/packages/', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },

  { exact: 'platform/package.json', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/package-lock.json', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/.dockerignore', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/scripts/config-validation.mjs', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/tsconfig.base.json', ci: BOTH_PLATFORM_SERVICES, deploy: BOTH_PLATFORM_SERVICES },
  { exact: 'platform/scripts/config-validation.d.mts', ci: BOTH_PLATFORM_SERVICES, deploy: [] },
  { exact: 'platform/eslint.config.mjs', ci: BOTH_PLATFORM_SERVICES, deploy: [] },
  { exact: 'platform/.gitignore', ci: [], deploy: [] },
  { exact: 'platform/.nvmrc', ci: [], deploy: [] },
  { exact: 'web/package.json', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/package-lock.json', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/Dockerfile', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/.dockerignore', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/eslint.config.js', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { exact: 'web/vitest.config.js', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { prefix: 'web/nginx/', ci: ALL_WEB_SERVICES, deploy: ALL_WEB_SERVICES },
  { prefix: 'web/.impeccable/', ci: [], deploy: [] },
  { exact: 'web/PRODUCT.md', ci: [], deploy: [] },
  { exact: 'web/DESIGN.md', ci: [], deploy: [] },
  { exact: 'web/README.md', ci: [], deploy: [] },
  { exact: 'web/AGENTS.md', ci: [], deploy: [] },
  { exact: 'web/CLAUDE.md', ci: [], deploy: [] },
  { exact: 'web/.gitignore', ci: [], deploy: [] },
  { exact: 'web/.nvmrc', ci: [], deploy: [] },

  // Known repository areas outside service CI and deployment.
  { prefix: 'docs/', ci: [], deploy: [] },
  { prefix: 'extension/', ci: [], deploy: [] },
  { prefix: 'addon/', ci: [], deploy: [] },
  { prefix: '.github/', ci: [], deploy: [] },
  { prefix: '.claude/', ci: [], deploy: [] },
  { prefix: '.codex/', ci: [], deploy: [] },
  { prefix: 'scripts/ci/', ci: [], deploy: [] },
  { exact: 'scripts/verify-live.ps1', ci: [], deploy: [] },
  { prefix: '.impeccable/', ci: [], deploy: [] },
  { prefix: '.agents/', ci: [], deploy: [] },
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
      client: ci.has('client'),
      'web-launcher': ci.has('web-launcher'),
      'web-storybook': ci.has('web-storybook')
    },
    deploy: {
      api: deploy.has('api'),
      portal: deploy.has('portal'),
      renderer: deploy.has('renderer'),
      client: deploy.has('client'),
      'web-launcher': deploy.has('web-launcher'),
      'web-storybook': deploy.has('web-storybook')
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
    web_launcher: result.ci['web-launcher'],
    web_storybook: result.ci['web-storybook'],
    deploy_api: result.deploy.api,
    deploy_portal: result.deploy.portal,
    deploy_renderer: result.deploy.renderer,
    deploy_client: result.deploy.client,
    deploy_web_launcher: result.deploy['web-launcher'],
    deploy_web_storybook: result.deploy['web-storybook']
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

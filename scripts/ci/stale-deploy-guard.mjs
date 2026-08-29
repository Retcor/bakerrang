import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { classifyChanges } from './classify-changes.mjs'

const SERVICES = new Set(['api', 'portal', 'renderer', 'client'])
const git = (cwd, args, encoding = 'utf8') => execFileSync('git', args, {
  cwd,
  encoding,
  stdio: ['ignore', 'pipe', 'pipe']
})

const requireCommit = (cwd, revision) => {
  try {
    git(cwd, ['cat-file', '-e', `${revision}^{commit}`])
  } catch {
    throw new Error(`Required commit is missing: ${revision}`)
  }
}

export function evaluateStaleDeployment ({ cwd = process.cwd(), service, triggerSha, currentRef = 'origin/main' }) {
  if (!SERVICES.has(service)) throw new Error(`Unsupported service: ${service}`)
  if (!triggerSha) throw new Error('The triggering SHA is required.')

  requireCommit(cwd, triggerSha)
  requireCommit(cwd, currentRef)
  const currentSha = git(cwd, ['rev-parse', currentRef]).trim()

  if (currentSha === triggerSha) return { shouldDeploy: true, currentSha, reason: 'current' }

  try {
    git(cwd, ['merge-base', '--is-ancestor', triggerSha, currentSha])
  } catch {
    throw new Error(`${triggerSha} is not an ancestor of ${currentSha}; refusing to deploy across rewritten or non-linear main history.`)
  }

  const changed = git(cwd, [
    'diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z', `${triggerSha}..${currentSha}`
  ], 'buffer').toString().split('\0').filter(Boolean)
  const classification = classifyChanges(changed)

  if (classification.unknown.length) {
    throw new Error(`Unclassified repository path in stale-job range:\n${classification.unknown.join('\n')}`)
  }

  const superseded = classification.deploy[service]
  return {
    shouldDeploy: !superseded,
    currentSha,
    reason: superseded ? 'superseded' : 'latest-relevant',
    changed,
    deploy: classification.deploy
  }
}

function argument (args, name, fallback = null) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}

function runCli () {
  const args = process.argv.slice(2)
  const result = evaluateStaleDeployment({
    service: argument(args, '--service'),
    triggerSha: argument(args, '--trigger-sha'),
    currentRef: argument(args, '--current-ref', 'origin/main')
  })
  console.log(JSON.stringify(result, null, 2))

  const outputPath = argument(args, '--github-output')
  if (outputPath) {
    fs.appendFileSync(outputPath, [
      `should_deploy=${result.shouldDeploy}`,
      `current_sha=${result.currentSha}`,
      `reason=${result.reason}`,
      ''
    ].join('\n'))
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

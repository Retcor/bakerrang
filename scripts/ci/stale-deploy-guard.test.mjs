import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { evaluateStaleDeployment } from './stale-deploy-guard.mjs'

const run = (cwd, command, args) => execFileSync(command, args, { cwd, stdio: 'ignore' })

const fixture = () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bakerrang-stale-'))
  run(cwd, 'git', ['init', '--initial-branch=main'])
  run(cwd, 'git', ['config', 'user.email', 'ci@example.invalid'])
  run(cwd, 'git', ['config', 'user.name', 'CI Test'])
  const commit = (repositoryPath, contents) => {
    const absolutePath = path.join(cwd, repositoryPath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, contents)
    run(cwd, 'git', ['add', repositoryPath])
    run(cwd, 'git', ['commit', '-m', repositoryPath])
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  }
  return { cwd, commit }
}

test('deploys when the trigger is current', t => {
  const repository = fixture()
  t.after(() => fs.rmSync(repository.cwd, { recursive: true, force: true }))
  const triggerSha = repository.commit('server/app.js', 'a')
  assert.equal(evaluateStaleDeployment({ cwd: repository.cwd, service: 'api', triggerSha, currentRef: 'main' }).reason, 'current')
})

test('skips when a newer commit affects the same service', t => {
  const repository = fixture()
  t.after(() => fs.rmSync(repository.cwd, { recursive: true, force: true }))
  const triggerSha = repository.commit('server/app.js', 'a')
  repository.commit('server/routes/health.js', 'newer api')
  assert.equal(evaluateStaleDeployment({ cwd: repository.cwd, service: 'api', triggerSha, currentRef: 'main' }).shouldDeploy, false)
})

test('deploys when newer commits affect a different service or only docs', t => {
  const repository = fixture()
  t.after(() => fs.rmSync(repository.cwd, { recursive: true, force: true }))
  const triggerSha = repository.commit('server/app.js', 'a')
  repository.commit('platform/apps/portal/app/page.tsx', 'portal')
  repository.commit('docs/deployment.md', 'docs')
  const result = evaluateStaleDeployment({ cwd: repository.cwd, service: 'api', triggerSha, currentRef: 'main' })
  assert.equal(result.shouldDeploy, true)
  assert.equal(result.reason, 'latest-relevant')
})

test('fails closed for non-ancestor history and unknown paths', t => {
  const repository = fixture()
  t.after(() => fs.rmSync(repository.cwd, { recursive: true, force: true }))
  const triggerSha = repository.commit('server/app.js', 'a')
  run(repository.cwd, 'git', ['checkout', '--orphan', 'rewritten'])
  repository.commit('docs/rewrite.md', 'rewrite')
  assert.throws(
    () => evaluateStaleDeployment({ cwd: repository.cwd, service: 'api', triggerSha, currentRef: 'rewritten' }),
    /not an ancestor/
  )
  run(repository.cwd, 'git', ['checkout', 'main'])
  repository.commit('unknown-root/file.txt', 'unknown')
  assert.throws(
    () => evaluateStaleDeployment({ cwd: repository.cwd, service: 'api', triggerSha, currentRef: 'main' }),
    /Unclassified repository path/
  )
})

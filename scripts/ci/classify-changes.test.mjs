import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyChanges } from './classify-changes.mjs'

const expected = (ci, deploy = ci) => ({
  ci: { api: false, 'web-launcher': false, 'web-storybook': false, 'web-polyglot': false, 'web-sign': false, 'web-budget': false, 'web-passwords': false, 'web-account': false, ...ci },
  deploy: { api: false, 'web-launcher': false, 'web-storybook': false, 'web-polyglot': false, 'web-sign': false, 'web-budget': false, 'web-passwords': false, 'web-account': false, ...deploy },
  unknown: []
})

test('classifies API-only source and lockfile changes', () => {
  assert.deepEqual(classifyChanges(['server/routes/tenants.js']), expected({ api: true }))
  assert.deepEqual(classifyChanges(['server/package-lock.json']), expected({ api: true }))
})

test('keeps retired areas classifiable but never schedules CI or a deploy for them', () => {
  for (const repositoryPath of [
    'client/src/App.jsx',
    'client/package-lock.json',
    'platform/apps/portal/app/page.tsx',
    'platform/package-lock.json',
    'extension/src/background.js',
    'addon/WoWAdvisor/WoWAdvisor.lua'
  ]) {
    assert.deepEqual(classifyChanges([repositoryPath]), expected({}), repositoryPath)
  }
})

test('classifies the Launcher nginx config (apex redirect) for the Launcher only', () => {
  assert.deepEqual(classifyChanges(['web/nginx/apps/launcher.conf']), expected({ 'web-launcher': true }))
})

test('keeps the brand masters out of every service build', () => {
  assert.deepEqual(classifyChanges(['web/brand/bakerrang-logo.png']), expected({}))
})

test('classifies Launcher source for Launcher CI and deployment only', () => {
  assert.deepEqual(
    classifyChanges(['web/apps/launcher/src/App.jsx']),
    expected({ 'web-launcher': true })
  )
})

test('classifies Story Book source for Story Book CI and deployment only', () => {
  assert.deepEqual(
    classifyChanges(['web/apps/storybook/src/App.jsx']),
    expected({ 'web-storybook': true })
  )
})

test('classifies Polyglot source for Polyglot CI and deployment only', () => {
  assert.deepEqual(classifyChanges(['web/apps/polyglot/src/App.jsx']), expected({ 'web-polyglot': true }))
})

test('classifies Sign source for Sign CI and deployment only', () => {
  assert.deepEqual(classifyChanges(['web/apps/sign/src/App.jsx']), expected({ 'web-sign': true }))
})

test('classifies Budget source for Budget CI and deployment only', () => {
  assert.deepEqual(classifyChanges(['web/apps/budget/src/App.jsx']), expected({ 'web-budget': true }))
})

test('classifies Passwords source and nginx config for Passwords only', () => {
  assert.deepEqual(classifyChanges(['web/apps/passwords/src/App.jsx']), expected({ 'web-passwords': true }))
  assert.deepEqual(classifyChanges(['web/nginx/apps/passwords.conf']), expected({ 'web-passwords': true }))
})

test('classifies Account source and nginx config for Account only', () => {
  assert.deepEqual(classifyChanges(['web/apps/account/src/App.jsx']), expected({ 'web-account': true }))
  assert.deepEqual(classifyChanges(['web/apps/account/package.json']), expected({ 'web-account': true }))
  assert.deepEqual(classifyChanges(['web/nginx/apps/account.conf']), expected({ 'web-account': true }))
  assert.deepEqual(classifyChanges(['web/nginx/apps/passwords.conf']), expected({ 'web-passwords': true }))
})

test('keeps server and Account design-record changes from crossing into Account', () => {
  assert.deepEqual(classifyChanges(['server/routes/account.js', 'server/routes/textToSpeech.js']), expected({ api: true }))
  assert.deepEqual(classifyChanges(['docs/apps/PhaseH-Account.md', 'docs/apps/Account-PhaseH-Runbook.md']), expected({}))
  assert.deepEqual(classifyChanges(['web/.impeccable/mocks/account-comp.html', 'web/.impeccable/surfaces/account.md']), expected({}))
})

test('fans shared consumer packages and workspace infrastructure out to all web apps', () => {
  for (const repositoryPath of [
    'web/packages/web-tokens/src/tokens.css',
    'web/package.json',
    'web/package-lock.json',
    'web/Dockerfile',
    'web/nginx/nginx.conf',
    'web/eslint.config.js',
    'web/vitest.config.js'
  ]) {
    assert.deepEqual(
      classifyChanges([repositoryPath]),
      expected({ 'web-launcher': true, 'web-storybook': true, 'web-polyglot': true, 'web-sign': true, 'web-budget': true, 'web-passwords': true, 'web-account': true }),
      repositoryPath
    )
  }
})

test('a shared theme or shell change redeploys all seven consumer apps, Account included', () => {
  for (const repositoryPath of ['web/packages/web-theme/src/index.jsx', 'web/packages/web-app-shell/src/index.jsx', 'web/apps/launcher/src/Launcher.jsx']) {
    const result = classifyChanges([repositoryPath])
    const deployed = Object.entries(result.deploy).filter(([, value]) => value).map(([name]) => name)
    if (repositoryPath.startsWith('web/packages/')) {
      assert.deepEqual(deployed, ['web-launcher', 'web-storybook', 'web-polyglot', 'web-sign', 'web-budget', 'web-passwords', 'web-account'], repositoryPath)
    } else {
      assert.deepEqual(deployed, ['web-launcher'], repositoryPath)
    }
  }
})

test('keeps consumer design and workspace guidance repository-only', () => {
  for (const repositoryPath of [
    'web/PRODUCT.md',
    'web/DESIGN.md',
    'web/.impeccable/mocks/launcher-comp.html',
    'web/README.md',
    'web/AGENTS.md',
    'web/CLAUDE.md',
    'web/.nvmrc'
  ]) {
    assert.deepEqual(classifyChanges([repositoryPath]), expected({}), repositoryPath)
  }
})

test('fails closed on unknown consumer app and root paths', () => {
  assert.deepEqual(classifyChanges(['web/apps/future/src/App.jsx']).unknown, ['web/apps/future/src/App.jsx'])
  assert.deepEqual(classifyChanges(['web/unrecognized.config.js']).unknown, ['web/unrecognized.config.js'])
})

test('explicitly classifies docs, non-service applications, workflows, and ops as no-service', () => {
  for (const repositoryPath of [
    'README.md',
    'docs/CI-CD.md',
    '.github/workflows/ci.yml',
    'scripts/verify-live.ps1',
    'scripts/deploy-dev.ps1',
    'firebase.json'
  ]) {
    assert.deepEqual(classifyChanges([repositoryPath]), expected({}), repositoryPath)
  }
})

test('classifies nested Impeccable and agent tooling as repository-only paths', () => {
  for (const repositoryPath of [
    '.impeccable/mocks/builder-rail-states.html',
    '.impeccable/config.json',
    '.agents/skills/impeccable/reference/polish.md'
  ]) {
    assert.deepEqual(classifyChanges([repositoryPath]), expected({}), repositoryPath)
  }
})

test('combines API and web app changes', () => {
  assert.deepEqual(
    classifyChanges(['server/app.js', 'web/apps/passwords/src/App.jsx']),
    expected({ api: true, 'web-passwords': true })
  )
})

test('normalizes Windows separators and deduplicates paths', () => {
  assert.deepEqual(
    classifyChanges(['web\\apps\\budget\\src\\App.jsx', './web/apps/budget/src/App.jsx']),
    expected({ 'web-budget': true })
  )
})

test('reports unknown paths instead of silently accepting them', () => {
  assert.deepEqual(classifyChanges(['some-new-unknown-root/file.txt']), {
    ...expected({}),
    unknown: ['some-new-unknown-root/file.txt']
  })
})

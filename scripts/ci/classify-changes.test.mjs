import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyChanges } from './classify-changes.mjs'

const expected = (ci, deploy = ci) => ({
  ci: { api: false, portal: false, renderer: false, client: false, 'web-launcher': false, 'web-storybook': false, 'web-polyglot': false, ...ci },
  deploy: { api: false, portal: false, renderer: false, client: false, 'web-launcher': false, 'web-storybook': false, 'web-polyglot': false, ...deploy },
  unknown: []
})

test('classifies API-only source and lockfile changes', () => {
  assert.deepEqual(classifyChanges(['server/routes/tenants.js']), expected({ api: true }))
  assert.deepEqual(classifyChanges(['server/package-lock.json']), expected({ api: true }))
})

test('classifies Client source for Client CI and deployment only', () => {
  assert.deepEqual(classifyChanges(['client/src/App.jsx']), expected({ client: true }))
  assert.deepEqual(classifyChanges(['client/package-lock.json']), expected({ client: true }))
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
      expected({ 'web-launcher': true, 'web-storybook': true, 'web-polyglot': true }),
      repositoryPath
    )
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

test('classifies app-only paths', () => {
  assert.deepEqual(classifyChanges(['platform/apps/portal/app/page.tsx']), expected({ portal: true }))
  assert.deepEqual(classifyChanges(['platform/apps/site-renderer/app/page.tsx']), expected({ renderer: true }))
})

test('fans shared packages out according to the dependency graph', () => {
  assert.deepEqual(classifyChanges(['platform/packages/site-schema/src/index.ts']), expected({ portal: true, renderer: true }))
  assert.deepEqual(classifyChanges(['platform/packages/ui/src/Button.tsx']), expected({ portal: true, renderer: true }))
  assert.deepEqual(classifyChanges(['platform/packages/site-components/src/Hero.tsx']), expected({ portal: true, renderer: true }))
  assert.deepEqual(classifyChanges(['platform/packages/site-runtime/src/SitePageRenderer.tsx']), expected({ portal: true, renderer: true }))
})

test('classifies shared platform build inputs for CI and deployment', () => {
  for (const repositoryPath of [
    'platform/package-lock.json',
    'platform/package.json',
    'platform/.dockerignore',
    'platform/scripts/config-validation.mjs',
    'platform/tsconfig.base.json'
  ]) {
    assert.deepEqual(classifyChanges([repositoryPath]), expected({ portal: true, renderer: true }), repositoryPath)
  }
})

test('keeps lint and declaration inputs CI-only', () => {
  for (const repositoryPath of [
    'platform/eslint.config.mjs',
    'platform/scripts/config-validation.d.mts'
  ]) {
    assert.deepEqual(
      classifyChanges([repositoryPath]),
      expected({ portal: true, renderer: true }, {}),
      repositoryPath
    )
  }
})

test('explicitly classifies docs, non-service applications, workflows, and ops as no-service', () => {
  for (const repositoryPath of [
    'README.md',
    'docs/CI-CD.md',
    'extension/src/background.js',
    'addon/WoWAdvisor/WoWAdvisor.lua',
    '.github/workflows/ci.yml',
    'platform/.gitignore',
    'platform/.nvmrc',
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

test('combines API and Portal changes', () => {
  assert.deepEqual(
    classifyChanges(['server/app.js', 'platform/apps/portal/app/page.tsx']),
    expected({ api: true, portal: true })
  )
})

test('keeps repository-only tooling out of a mixed Portal change', () => {
  assert.deepEqual(
    classifyChanges(['.impeccable/mocks/x.html', 'platform/apps/portal/app/page.tsx']),
    expected({ portal: true })
  )
})

test('combines Portal and Renderer changes', () => {
  assert.deepEqual(
    classifyChanges(['platform/apps/portal/app/page.tsx', 'platform/apps/site-renderer/app/page.tsx']),
    expected({ portal: true, renderer: true })
  )
})

test('combines all three services', () => {
  assert.deepEqual(
    classifyChanges(['server/app.js', 'platform/packages/ui/src/Button.tsx']),
    expected({ api: true, portal: true, renderer: true })
  )
})

test('keeps Client independent from API and Platform dependency fan-out', () => {
  assert.deepEqual(
    classifyChanges([
      'client/src/App.jsx',
      'platform/packages/site-schema/src/index.ts',
      'platform/packages/ui/src/Button.tsx',
      'platform/packages/site-components/src/Hero.tsx'
    ]),
    expected({ client: true, portal: true, renderer: true })
  )
})

test('normalizes Windows separators and deduplicates paths', () => {
  assert.deepEqual(
    classifyChanges(['platform\\apps\\portal\\app\\page.tsx', './platform/apps/portal/app/page.tsx']),
    expected({ portal: true })
  )
})

test('reports unknown paths instead of silently accepting them', () => {
  assert.deepEqual(classifyChanges(['some-new-unknown-root/file.txt']), {
    ...expected({}),
    unknown: ['some-new-unknown-root/file.txt']
  })
})

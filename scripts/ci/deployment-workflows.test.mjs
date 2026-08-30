import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

import { classifyChanges } from './classify-changes.mjs'

const workflowDir = new URL('../../.github/workflows/', import.meta.url)
const reusablePath = new URL('_deploy-cloud-run.yml', workflowDir)
const mainPath = new URL('deploy.yml', workflowDir)
const prPath = new URL('ci.yml', workflowDir)
const verifyPath = new URL('verify-live.yml', workflowDir)
const retiredPaths = [
  new URL('deploy-dev.yml', workflowDir),
  new URL('verify-gcp-auth-dev.yml', workflowDir),
  new URL('../../scripts/deploy-dev.ps1', import.meta.url)
]

const workflowNames = (await readdir(workflowDir)).filter(name => name.endsWith('.yml')).sort()
const activeWorkflows = await Promise.all(
  workflowNames.map(async name => [name, (await readFile(new URL(name, workflowDir), 'utf8')).replaceAll('\r\n', '\n')])
)
const workflowText = activeWorkflows.map(([, contents]) => contents).join('\n')
const reusable = (await readFile(reusablePath, 'utf8')).replaceAll('\r\n', '\n')
const main = (await readFile(mainPath, 'utf8')).replaceAll('\r\n', '\n')
const pr = (await readFile(prPath, 'utf8')).replaceAll('\r\n', '\n')
const verify = (await readFile(verifyPath, 'utf8')).replaceAll('\r\n', '\n')

const job = (workflow, id) => {
  const match = workflow.match(new RegExp(`^  ${id}:\\n[\\s\\S]*?(?=^  [a-z][a-z0-9-]*:\\n|(?![\\s\\S]))`, 'm'))
  assert.ok(match, `missing job: ${id}`)
  return match[0]
}

test('DEV cloud deployment entrypoints are retired', async () => {
  for (const retiredPath of retiredPaths) {
    await assert.rejects(access(retiredPath), error => error?.code === 'ENOENT')
  }
  assert.deepEqual(workflowNames, ['_deploy-cloud-run.yml', 'ci.yml', 'deploy.yml', 'verify-live.yml'])
})

test('MAIN remains automatic on main and manually dispatchable', () => {
  assert.match(main, /^  push:\n    branches:\n      - main$/m)
  assert.match(main, /^  workflow_dispatch:$/m)
  assert.doesNotMatch(main, /^      - production$/m)

  const dispatch = main.match(/^  workflow_dispatch:\n[\s\S]*?(?=^permissions:)/m)?.[0] ?? ''
  assert.match(dispatch, /required: true/)
  assert.match(dispatch, /options:\n          - api\n          - portal\n          - renderer\n          - client/)
  assert.doesNotMatch(dispatch, /- all/)
  assert.match(job(main, 'guard-main'), /refs\/heads\/main/)
  assert.match(job(main, 'deploy-selected-service'), /needs: guard-main/)
  assert.match(job(main, 'deploy-selected-service'), /service: \$\{\{ inputs\.service \}\}/)
})

test('push classification uses the authoritative classifier and actual push range', () => {
  const changes = job(main, 'changes')
  assert.match(changes, /github\.event\.before/)
  assert.match(changes, /github\.sha/)
  assert.match(changes, /git merge-base --is-ancestor "\$BEFORE" "\$AFTER"/)
  assert.match(changes, /"\$BEFORE\.\.\$AFTER"/)
  assert.match(changes, /classify-changes\.mjs --input/)
  assert.match(changes, /refusing to classify an invalid range/)
  for (const service of ['api', 'portal', 'renderer', 'client']) {
    assert.match(changes, new RegExp(`deploy_${service}: \\$\\{\\{ steps\\.classify\\.outputs\\.deploy_${service} \\}\\}`))
  }
})

test('only MAIN deployment callers receive OIDC and all use production', () => {
  assert.doesNotMatch(job(main, 'changes'), /id-token/)
  assert.doesNotMatch(job(main, 'validate-api'), /id-token/)
  assert.doesNotMatch(job(main, 'validate-platform'), /id-token/)
  assert.doesNotMatch(job(main, 'validate-client'), /id-token/)
  assert.doesNotMatch(job(main, 'live-deploy-passed'), /id-token/)
  assert.doesNotMatch(pr, /id-token/)

  for (const id of ['deploy-api', 'deploy-portal', 'deploy-renderer', 'deploy-client', 'deploy-selected-service']) {
    const deployment = job(main, id)
    assert.match(deployment, /id-token: write/)
    assert.match(deployment, /uses: \.\/\.github\/workflows\/_deploy-cloud-run\.yml/)
    assert.match(deployment, /environment: production/)
    assert.match(deployment, /smoke_via_service_url: true/)
  }
  assert.equal((main.match(/id-token: write/g) ?? []).length, 5)
})

test('no active workflow contains a DEV deployment path or development Environment', () => {
  assert.doesNotMatch(workflowText, /environment: development/)
  assert.doesNotMatch(workflowText, /bakerrang-(?:api|portal|site-renderer)-dev/)
  assert.doesNotMatch(workflowText, /bakerrang-dev/)
  assert.doesNotMatch(workflowText, /verify DEV Workload Identity Federation/i)
  assert.doesNotMatch(workflowText, /deploy-dev\.ps1/)
})

test('public verification workflow is credential-free and uses fixed hosts only', () => {
  assert.doesNotMatch(verify, /id-token/)
  assert.match(verify, /^permissions:\n  contents: read$/m)
  assert.match(verify, /^  workflow_dispatch:$/m)
  assert.match(verify, /^  workflow_run:\n    workflows:\n      - Deploy MAIN\n    types:\n      - completed$/m)
  assert.match(verify, /^  schedule:\n    - cron: '[^']+'$/m)

  const dispatch = verify.match(/^  workflow_dispatch:\n[\s\S]*?(?=^  workflow_run:)/m)?.[0] ?? ''
  assert.match(dispatch, /deep:\n        description: [^\n]+\n        required: false\n        default: false\n        type: boolean/)
  assert.doesNotMatch(dispatch, /(?:url|host):/i)

  const urls = [...new Set(verify.match(/https:\/\/[^\s"']+/g) ?? [])].sort()
  assert.deepEqual(urls, [
    'https://api.bakerrang.com/health',
    'https://bakerrang.com/',
    'https://custom.bakerrang.com/',
    'https://portal.bakerrang.com/',
    'https://sites.bakerrang.com/robots.txt'
  ])
  assert.match(verify, /if \[\[ "\$DEEP" == "true" \]\]; then\n            check_endpoint custom https:\/\/custom\.bakerrang\.com\//)
})

test('failed Deploy MAIN runs still trigger diagnostic public verification', () => {
  assert.match(verify, /Deploy MAIN concluded '\$DEPLOY_CONCLUSION'/)
  assert.match(verify, /Public verification is still running as diagnostic evidence/)
  assert.doesNotMatch(job(verify, 'public-ingress'), /if: github\.event\.workflow_run\.conclusion == 'success'/)
})

test('each classifier output independently controls its MAIN service deployment', () => {
  const validation = {
    api: 'validate-api',
    portal: 'validate-platform',
    renderer: 'validate-platform',
    client: 'validate-client'
  }
  for (const service of ['api', 'portal', 'renderer', 'client']) {
    const deployment = job(main, `deploy-${service}`)
    assert.match(deployment, new RegExp(`needs\\.changes\\.outputs\\.deploy_${service} == 'true'`))
    assert.match(deployment, new RegExp(`needs\\.${validation[service]}\\.result == 'success'`))
    assert.match(deployment, new RegExp(`service: ${service}`))
  }
})

test('Phase B changed paths classify as no-service with no unknown paths', () => {
  const phaseBPaths = [
    '.github/workflows/deploy-dev.yml',
    '.github/workflows/verify-gcp-auth-dev.yml',
    'scripts/deploy-dev.ps1',
    'scripts/ci/classify-changes.mjs',
    'scripts/ci/deployment-workflows.test.mjs',
    'docs/CI-CD.md',
    'docs/DEV-DEPLOYMENT.md',
    'docs/infra/live-environment-bootstrap.md',
    'docs/infra/local-development.md',
    'docs/marketing-site/Step2/Step2.5e-DecommissionDevInfra-Spec.md',
    'docs/marketing-site/Step2/Step2.5e-DecommissionDevInfra-Plan.md'
  ]
  assert.deepEqual(classifyChanges(phaseBPaths), {
    ci: { api: false, portal: false, renderer: false, client: false },
    deploy: { api: false, portal: false, renderer: false, client: false },
    unknown: []
  })
})

test('Step 2.6a changed paths classify as no-service with no unknown paths', () => {
  const step26aPaths = [
    '.github/workflows/verify-live.yml',
    'scripts/verify-live.ps1',
    'scripts/ci/verify-live.test.ps1',
    'scripts/ci/classify-changes.mjs',
    'scripts/ci/classify-changes.test.mjs',
    'scripts/ci/deployment-workflows.test.mjs',
    'docs/CI-CD.md',
    'docs/marketing-site/Step2/Step2.6-DeployHardening-Spec.md',
    'docs/marketing-site/Step2/Step2.6-DeployHardening-Plan.md'
  ]
  assert.deepEqual(classifyChanges(step26aPaths), {
    ci: { api: false, portal: false, renderer: false, client: false },
    deploy: { api: false, portal: false, renderer: false, client: false },
    unknown: []
  })
})

test('aggregate status handles manual, affected, skipped, and no-service paths', () => {
  const aggregate = job(main, 'live-deploy-passed')
  assert.match(aggregate, /if: always\(\)/)
  assert.match(aggregate, /"\$EVENT_NAME" == "workflow_dispatch"/)
  assert.match(aggregate, /"\$EVENT_NAME" != "push"/)
  assert.match(aggregate, /"\$CHANGES_RESULT" != "success"/)
  for (const service of ['API', 'PORTAL', 'RENDERER', 'CLIENT']) {
    assert.match(aggregate, new RegExp(`"\\$DEPLOY_${service}" == "true"`))
    assert.match(aggregate, new RegExp(`"\\$${service}_RESULT" != "success"`))
  }
  assert.match(aggregate, /All affected MAIN\/live validations and deployments passed/)
})

test('reusable deployment stays immutable, image-only, stale-guarded, and per-service serialized', () => {
  assert.match(reusable, /stale-deploy-guard\.mjs/)
  assert.match(reusable, /group: deploy-\$\{\{ inputs\.environment \}\}-\$\{\{ inputs\.service \}\}/)
  assert.match(reusable, /cancel-in-progress: false/)
  assert.match(reusable, /tagged_image="\$\{IMAGE_REPOSITORY\}:\$\{IMAGE_TAG\}"/)
  assert.match(reusable, /image_with_digest=\$\{IMAGE_REPOSITORY\}@\$\{digest\}/)
  assert.match(reusable, /gcloud run services update "\$SERVICE_NAME"[\s\S]*?--image "\$IMAGE_WITH_DIGEST"/)
  assert.doesNotMatch(reusable, /gcloud run deploy/)
  assert.doesNotMatch(reusable, /--service-account/)
})

test('MAIN deployment smoke resolves and validates Cloud Run status.url', () => {
  assert.match(
    reusable,
    /gcloud run services describe "\$SERVICE_NAME"[\s\S]*?--format='value\(status\.url\)'/
  )
  assert.match(reusable, /\[\[ ! "\$service_url" =~ \^https:\/\/\[\^\[:space:\]\]\+\$ \]\]/)
  assert.match(reusable, /smoke_url="\$\{service_url%\/\}\$\{SMOKE_PATH\}"/)
  assert.equal((reusable.match(/tr -d '\\r\\n'/g) ?? []).length, 1)
  assert.equal((reusable.match(/grep -qi 'User-agent'/g) ?? []).length, 1)
  assert.equal((reusable.match(/grep -Fq '<div id="root"'/g) ?? []).length, 1)
})

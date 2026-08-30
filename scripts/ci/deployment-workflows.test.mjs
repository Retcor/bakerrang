import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reusablePath = new URL('../../.github/workflows/_deploy-cloud-run.yml', import.meta.url)
const mainPath = new URL('../../.github/workflows/deploy.yml', import.meta.url)
const devPath = new URL('../../.github/workflows/deploy-dev.yml', import.meta.url)
const prPath = new URL('../../.github/workflows/ci.yml', import.meta.url)

const workflows = await Promise.all([
  readFile(reusablePath, 'utf8'),
  readFile(mainPath, 'utf8'),
  readFile(devPath, 'utf8'),
  readFile(prPath, 'utf8')
])
const [reusable, main, dev, pr] = workflows.map(workflow => workflow.replaceAll('\r\n', '\n'))

const job = (workflow, id) => {
  const match = workflow.match(new RegExp(`^  ${id}:\\n[\\s\\S]*?(?=^  [a-z][a-z0-9-]*:\\n|(?![\\s\\S]))`, 'm'))
  assert.ok(match, `missing job: ${id}`)
  return match[0]
}

test('automatic deployment moves atomically from DEV to MAIN', () => {
  assert.match(main, /^  push:\n    branches:\n      - main$/m)
  assert.match(main, /^  workflow_dispatch:$/m)
  assert.doesNotMatch(main, /^      - production$/m)
  assert.doesNotMatch(dev, /^  push:$/m)
  assert.match(dev, /^  workflow_dispatch:$/m)
})

test('manual MAIN retains the exact four-service selector and main-ref guard', () => {
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

test('only deployment callers receive OIDC and all use production', () => {
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

test('each classifier output independently controls its service deployment', () => {
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

test('DEV is manual-only and retains stable-domain smoke behavior', () => {
  assert.doesNotMatch(dev, /smoke_via_service_url/)
  assert.match(dev, /environment: development/)
  assert.match(reusable, /smoke_via_service_url:\s*[\s\S]*?default: false\s*[\s\S]*?type: boolean/)
  assert.match(reusable, /smoke_url="\$\{NEXT_PUBLIC_API_BASE_URL%\/\}\/health"/)
  assert.match(reusable, /smoke_url="\$\{PORTAL_BASE_URL%\/\}\/"/)
  assert.match(reusable, /smoke_url="\$\{NEXT_PUBLIC_SITE_PREVIEW_ORIGIN%\/\}\/robots\.txt"/)
})

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const reusablePath = new URL('../../.github/workflows/_deploy-cloud-run.yml', import.meta.url);
const mainPath = new URL('../../.github/workflows/deploy.yml', import.meta.url);
const devPath = new URL('../../.github/workflows/deploy-dev.yml', import.meta.url);

const [reusable, main, dev] = await Promise.all([
  readFile(reusablePath, 'utf8'),
  readFile(mainPath, 'utf8'),
  readFile(devPath, 'utf8'),
]);

test('service URL smoke mode is optional and resolves Cloud Run status.url', () => {
  assert.match(
    reusable,
    /smoke_via_service_url:\s*[\s\S]*?default: false\s*[\s\S]*?type: boolean/,
  );
  assert.match(
    reusable,
    /gcloud run services describe "\$SERVICE_NAME"[\s\S]*?--format='value\(status\.url\)'/,
  );
  assert.match(reusable, /\[\[ ! "\$service_url" =~ \^https:\/\/\[\^\[:space:\]\]\+\$ \]\]/);
  assert.match(reusable, /smoke_url="\$\{service_url%\/\}\$\{SMOKE_PATH\}"/);
});

test('manual MAIN opts into Cloud Run service URL smoke mode', () => {
  assert.match(main, /environment: production[\s\S]*?smoke_via_service_url: true/);
});

test('DEV retains the reusable workflow default stable-domain smoke mode', () => {
  assert.doesNotMatch(dev, /smoke_via_service_url/);
  assert.match(reusable, /smoke_url="\$\{NEXT_PUBLIC_API_BASE_URL%\/\}\/health"/);
  assert.match(reusable, /smoke_url="\$\{PORTAL_BASE_URL%\/\}\/"/);
  assert.match(reusable, /smoke_url="\$\{NEXT_PUBLIC_SITE_PREVIEW_ORIGIN%\/\}\/robots\.txt"/);
  assert.match(reusable, /smoke_url="\$\{CLIENT_BASE_URL%\/\}\/"/);
});

test('all service-specific assertions remain in one smoke step', () => {
  assert.equal((reusable.match(/tr -d '\\r\\n'/g) ?? []).length, 1);
  assert.equal((reusable.match(/grep -qi 'User-agent'/g) ?? []).length, 1);
  assert.equal((reusable.match(/grep -Fq '<div id="root"'/g) ?? []).length, 1);
});

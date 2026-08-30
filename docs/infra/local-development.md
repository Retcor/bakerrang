# Local development infrastructure

Local development uses DEV data services directly. Application processes run locally; there is no DEV Cloud Run, load balancer, WIF deployment identity, or public DNS requirement.

## API and Google authentication

Use Application Default Credentials (ADC) or other approved local Google credentials. Never commit credential or secret values.

```powershell
$env:FIRESTORE_PROJECT_ID = "bakerrang-dev"
$env:MEDIA_BUCKET_NAME = "bakerrang-dev-media-marketing"
```

Start the API from `server/`; the expected local API origin is `http://localhost:8080`.

## Client

Copy `client/.env.example` to the ignored `client/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
```

Vite reads this at start/build time. Without an override, Client falls back to `https://api.bakerrang.com`, so verify the local file before tests that mutate data.

## Portal

Copy the checked-in example to the ignored local file:

```powershell
Set-Location platform
Copy-Item apps/portal/.env.local.example apps/portal/.env.local
npm run dev:portal
```

The current local contract is:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_SITE_PREVIEW_ORIGIN=http://localhost:3002
CUSTOM_DOMAIN_IPV4_ADDRESS=
CUSTOM_DOMAIN_CNAME_TARGET=
```

Leave the load-balancer targets empty for local development. Portal runs at `http://localhost:3001`, calls the local API, and opens preview against the local Renderer. Configure local Google OAuth browser/callback origins consistently with the API configuration; never reuse a deployed secret in a committed env file.

## Site Renderer

Start Renderer from `platform/` with `npm run dev:sites`; it listens on port `3002`. Replace `<renderer-port>` below with the actual local port if overridden:

```powershell
$env:SITE_API_BASE_URL = "http://localhost:8080"
$env:NEXT_PUBLIC_SITE_API_BASE_URL = "http://localhost:8080"
$env:SITE_PUBLIC_ORIGIN = "http://localhost:<renderer-port>"
$env:SITE_PUBLIC_INDEXING_ENABLED = "false"
```

Tenant routing requires a dotted host such as `acme.local` or `test.localhost`. Host normalization strips the port and rejects bare `localhost`.

```powershell
curl.exe -H "Host: acme.local" "http://localhost:<renderer-port>/"
```

For Windows browser testing, add a temporary line to `C:\Windows\System32\drivers\etc\hosts` from an elevated editor:

```text
127.0.0.1 acme.local
```

Browse to `http://acme.local:<renderer-port>/`, then remove the hosts-file entry after testing. Do not put local secret values in examples or committed files.

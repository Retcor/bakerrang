# Local development infrastructure

Local development uses DEV data services directly. It requires no local load balancer, WIF, or Cloud Run.

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

## Site Renderer

Replace `<renderer-port>` with the actual local port:

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

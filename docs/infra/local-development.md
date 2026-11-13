# Local development infrastructure

Local development uses DEV data services directly. Application processes run locally; there is no DEV Cloud Run, load balancer, WIF deployment identity, or public DNS requirement.

## API and Google authentication

Use Application Default Credentials (ADC) or other approved local Google credentials. Never commit credential or secret values.

Copy `server/.env.example` to the ignored `server/.env` and set at least:

```dotenv
FIRESTORE_PROJECT_ID=bakerrang-dev
SERVER_DOMAIN=http://localhost:8080
SESSION_SECRET=<random>
GOOGLE_OAUTH_CLIENT_ID=<id>
GOOGLE_OAUTH_CLIENT_SECRET=<secret>
```

Start the API from `server/` (`npm ci && npm start`); the expected local API origin is `http://localhost:8080`.

## Web apps

Install once at `web/` with `npm ci`, then start any app with `npm run dev:<app>`. Each app has a fixed local port, and the API only accepts browser origins (CORS) and OAuth return targets that are configured in `server/.env`:

| App | Command | Local origin | API env var |
|---|---|---|---|
| Launcher | `npm run dev:launcher` | `http://localhost:3000` | `LAUNCHER_DOMAIN` |
| Story Book | `npm run dev:storybook` | `http://localhost:3010` | `STORYBOOK_DOMAIN` |
| Polyglot | `npm run dev:polyglot` | `http://localhost:3020` | `POLYGLOT_DOMAIN` |
| Sign | `npm run dev:sign` | `http://localhost:3030` | `SIGN_DOMAIN` |
| Budget | `npm run dev:budget` | `http://localhost:3040` | `BUDGET_DOMAIN` |
| Passwords | `npm run dev:passwords` | `http://localhost:3050` | `PASSWORDS_DOMAIN` |
| Account | `npm run dev:account` | `http://localhost:3060` | `ACCOUNT_DOMAIN` |

In local dev the apps call `http://localhost:8080` unless `VITE_API_BASE_URL` overrides it (production builds always pass it as a Docker build arg). Links between apps can be pointed at local origins with the `VITE_<APP>_URL` overrides read by `@bakerrang/web-app-shell`.

`LAUNCHER_DOMAIN` is also where a login without `?target=` returns, and where a failed Google login lands.

# BakerRang

A small family of consumer web tools that share one Google sign-in, backed by a single Node/Express API.

| Path | What it is |
|---|---|
| `server/` | Express API (`api.bakerrang.com`): auth, account, Story Book, Polyglot (ChatGPT + speech), Budget, Password Vault, and the public `/chatbot` used by the dan-baker-info site. |
| `web/` | npm workspace of Vite + React 18 apps, one per subdomain: Launcher (`launch.`), Story Book, Polyglot, Sign, Budget, Passwords, Account. See [`web/README.md`](web/README.md). |
| `docs/` | CI/CD, infrastructure, operations runbooks, and the per-app migration history in `docs/apps/`. |

`https://bakerrang.com/` (and `www.`) is Cloud Run domain-mapped to the Launcher service, which 301-redirects it to
`https://launch.bakerrang.com/` (old `/passwords`, `/budget`, … paths go to the matching subdomain; see
`web/nginx/apps/launcher.conf`).

## Local setup

**Server:** copy `server/.env.example` to `server/.env` and fill it in (Google OAuth, OpenAI, ElevenLabs,
Deepgram, `SESSION_SECRET`, `FIRESTORE_PROJECT_ID`, `SERVER_DOMAIN`, and the `*_DOMAIN` origin of each web
app you run locally). Then:

```bash
cd server && npm ci && npm start
```

**Web apps:** see [`web/README.md`](web/README.md) (`npm ci` at `web/`, then `npm run dev -w @bakerrang/web-<app>`).

More detail: [`docs/infra/local-development.md`](docs/infra/local-development.md).

### Setting Up Firestore Locally

Firestore is used to store data. The Google account that has the Firestore will need to be setup locally and a default
account setup. The Firestore library will look for the Google credentials once logged in.

1. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   ```
2. **Set default project** (where the Firestore instance lives):
   ```bash
   gcloud config set project <Project ID>
   ```
3. **Add the default credentials file** used to authenticate calls to Firestore:
   ```bash
   gcloud auth application-default login
   ```

## Chatbot Vector Database (dan-baker-info)

The chatbot on the dan-baker-info site uses a vector database stored in Firestore to answer questions about work experience. The knowledge base lives in `server/data/dan-resume.md`.

### Updating the Knowledge Base

1. **Edit the markdown file** with new or updated information:
   ```
   server/data/dan-resume.md
   ```
   Add new jobs, projects, skills, or any detail you want the chatbot to know about. The file is organized by section — just add to or expand any section freely.

2. **Re-run the ingestion script** from the `server` directory:
   ```bash
   node scripts/ingestResume.js
   ```
   This will:
   - Delete all existing chunks from Firestore
   - Re-chunk and re-embed the entire markdown file
   - Write fresh documents to the `resume_chunks` collection

   The chatbot reflects the changes immediately on the next question asked — no server restart required.

### Firestore Index Setup

All Firestore indexes are defined in `firestore.indexes.json` at the project root and managed via the Firebase CLI:
the `resume_chunks` vector index (chatbot) and the two vault `audit` composite indexes (version history).

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:indexes
```

Indexes take 1–5 minutes to build. Check their status with `gcloud firestore indexes composite list`.

## Deploy

Every service runs on Cloud Run and is deployed by GitHub Actions on merge to `main` — only the services a
change affects are rebuilt. See [`docs/CI-CD.md`](docs/CI-CD.md), and
[`docs/operations/`](docs/operations) for live checks and rollback.

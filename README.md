A webapp frontend that interfaces with a node backend that serves as a learning playground for different technologies

## Local setup

Navigate to client directory and run `npm i`. Then, run `npm run dev` to start the client app using Vite.

Update the .env file with API keys for Elevenlabs and ChatGPT and Google Credentials and then navigate to server directory and run `npm i`. 
Then, run `npm run start` to start the server app using Express.

### Setting Up Firestore Locally

Firestore is used to store data. The Google account that has the Firestore will need to be setup locally and a default
account setup. The Firestore library will look for the Google credentials once logged in.

1. **Authenticate with Google Cloud**:
   Make sure you are logged in with your Google account in the Google Cloud CLI:
   ```bash
   gcloud auth login
2. **Set default project**:
   Set the default Google project where the Firestore instance lives:
   ```bash
   gcloud config set project <Project ID>
3. **Add the default credentials file**:
   This will add the application_default_credentials.json credentials file to be used to authenticate calls to Firestore:
   ```bash
   gcloud auth application-default login

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

## WoW Game Data Knowledge Base (wow_game_data)

The WoW Advisor RAG system uses a shared Firestore collection (`wow_game_data`) that stores global WoW knowledge — achievements, expansion info, playable classes/specs, M+ dungeons, boss encounters, reputation factions, tier set bonuses, professions, mount index, title index, and toys/pets. This data is shared across all users and characters. It is populated manually via the scripts below — the server does not auto-populate on startup.

### Populating the Knowledge Base

Run the population script manually from the `server/` directory whenever you want to refresh the data (e.g. after a new patch, new season, or first-time setup):

```bash
node scripts/populateWowGameData.js                        # all regions, staleness check
node scripts/populateWowGameData.js us                     # single region, staleness check
node scripts/populateWowGameData.js us eu                  # specific regions, staleness check
node scripts/populateWowGameData.js us --customTierSets    # force-refresh customTierSets for us only
node scripts/populateWowGameData.js us --customTierSets --professions  # force multiple types
node scripts/populateWowGameData.js --force                # force-refresh all types, all regions
node scripts/populateWowGameData.js us --force             # force-refresh all types for us only
```

### Custom Tier Set Bonuses (`wow-tier-sets.md`)

Current-expansion tier set bonuses are not available through the Blizzard API. Instead they are maintained in `server/data/wow-tier-sets.md` and ingested as part of the population process.

**To update tier set bonuses:**
1. Log into WoW and type `/wowadvisor tiersets` in chat
2. A popup will appear with all tier set bonuses from the current encounter journal — press **Ctrl+A** then **Ctrl+C** to copy
3. Replace the contents of `server/data/wow-tier-sets.md` with the copied text
4. Run: `node scripts/populateWowGameData.js --customTierSets`

Re-run this process after any patch that changes tier set bonuses.

Each data type has a **24-hour staleness check** — re-running within 24 hours will skip anything already fresh. Use `--typeName` flags to force-refresh specific types regardless of staleness. On first run, expect the script to take several minutes since boss encounter details are fetched for every dungeon and raid in the game.

**Available `--type` flags:**
```
--allAchievements       --expansionInfo         --playableClasses
--playableSpecs         --mythicKeystoneDungeons  --journalInstances
--reputationFactions    --customTierSets        --professions
--mountIndex            --titleIndex            --toyPetIndex
--force                 (shorthand for all of the above)
```

**Prerequisites:**
- `CHAT_GPT_API_KEY` set in `.env` (used for embeddings)
- `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` set in `.env`
- Firestore credentials configured (`gcloud auth application-default login`)
- The `wow_game_data` Firestore vector index must exist (see index setup below)

### First-Time Firestore Vector Index Setup

All Firestore vector indexes are defined in `firestore.indexes.json` at the project root and managed via the Firebase CLI.

**Install the Firebase CLI** (if not already installed):
```bash
npm install -g firebase-tools
firebase login
```

**Deploy all indexes** (run once, or any time `firestore.indexes.json` changes):
```bash
firebase deploy --only firestore:indexes
```

This will create indexes for `resume_chunks` (chatbot), `wow_character_chunks` (WoW Advisor per-user RAG), and `wow_game_data` (WoW Advisor global game knowledge). Indexes take 1–5 minutes to build. Check their status with:
```bash
gcloud firestore indexes composite list
```

Wait until all indexes show `READY` before using the features that depend on them.

### Environment Variables Required

Add the following to the server `.env` file:
```
CHAT_GPT_API_KEY=...          # OpenAI API key — used for GPT, embeddings, vision, and RAG
ELEVEN_LABS_API_KEY=...       # ElevenLabs API key — used for TTS and voice cloning
DEEPGRAM_API_KEY=...          # Deepgram API key — used for speech-to-text transcription
GOOGLE_OAUTH_CLIENT_ID=...    # Google OAuth client ID — used for user authentication
GOOGLE_OAUTH_CLIENT_SECRET=.. # Google OAuth client secret — used for user authentication
CLIENT_DOMAIN=...             # URL of the frontend client (e.g. http://localhost:3001)
SERVER_DOMAIN=...             # URL of this server (e.g. http://localhost:8080)
CHATBOT_ORIGIN=...            # Allowed origin for the dan-baker-info chatbot (e.g. https://danbaker.info)
CHATBOT_VOICE_ID=...          # ElevenLabs voice ID used for chatbot audio responses
BLIZZARD_CLIENT_ID=...        # Blizzard API client ID — used for WoW character lookups
BLIZZARD_CLIENT_SECRET=...    # Blizzard API client secret — used for WoW character lookups
```

## WoW Advisor (/wow)

A World of Warcraft character advisor page at `/wow`. Look up any character by name, realm, and region to see their stats and chat with GPT-4o for specific improvement advice.

### Features
- Character summary: item level, Mythic+ score, raid progress, per-slot gear breakdown, recent M+ runs
- Streaming AI chat powered by GPT-4o with character context in the system prompt
- Extended in-game data via the BakerRang Advisor addon (world quests, vault, currencies, affixes, stats, mounts, bag inventory, bank contents)
- Per-user vector database (RAG) — extended addon data is embedded and stored in Firestore per character, persisting between sessions and enabling semantic search so only relevant context is injected per question
- Global game knowledge RAG — expansion info, full achievement index, M+ dungeons, boss encounters, reputation factions, tier set bonuses, professions, mounts, titles, and toys/pets are stored in a shared `wow_game_data` collection, available to all characters without duplication
- Recent characters list stored in localStorage for quick re-lookup
- Character data pulled from the Blizzard API and RaiderIO

### Blizzard API Setup

1. Go to [develop.battle.net](https://develop.battle.net/access/clients/create) and create a new client
2. Set the **Service URL** and **Redirect URI** to your site's domain (e.g. `https://bakerrang.com`)
3. Copy the generated **Client ID** and **Client Secret** into the server `.env` file as `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET`

The WoW Advisor uses the **Client Credentials** OAuth flow (server-to-server), so no user login or redirect URI handling is needed — the credentials are used purely to authenticate Blizzard API requests from the backend.

### Data Sources
- **Blizzard API** (`us/eu/kr/tw.api.blizzard.com`) — character profile, equipped items with ilvl per slot, active specialization/talents
- **RaiderIO API** (free, no key needed) — Mythic+ score for the current season, recent M+ runs, raid progression summary
- **BakerRang Advisor addon** (optional) — live in-game data pasted by the user for richer AI context

### BakerRang Advisor — WoW Addon

The addon lives at `addon/WoWAdvisor/`. It collects live in-game data and sends it to the WoW Advisor page to give the AI richer context than the Blizzard API alone provides.

**Data collected by the addon** (`/wowadvisor`):
- Character basics (name, realm, level, class, spec, item level)
- Active world quests in the current zone and nearby zones
- Great Vault weekly reward slots (progress, threshold, available ilvl)
- Currencies (Resonance Crystals, Valor, Honor, Conquest)
- Current Mythic+ affixes with descriptions
- Secondary stats (Crit, Haste, Mastery, Versatility percentages)
- Mount collection count
- Bag inventory (all non-grey items across all 5 bag slots)
- Bank contents (captured automatically when the bank is opened in-game)

**Data fetched from Blizzard API on paste** (enriches the character's saved data):
- All completed achievements with timestamps
- Collected mount names
- Reputation standings with all factions (value, standing, renown level)
- Mythic+ keystone profile — season score and best key level timed per dungeon
- Professions — primary and secondary with skill level and tier breakdowns
- Active talent build — every selected talent node and PvP talents
- PvP summary — honor level, honorable kills, bracket ratings and W/L records
- Collected battle pets and toys
- Earned character titles
- Primary statistics (strength, agility, intellect, stamina, armor, crit, haste, mastery, versatility)

**Installation:**

1. Copy the `addon/WoWAdvisor/` folder into your WoW addons directory:
   ```
   World of Warcraft/_retail_/Interface/AddOns/WoWAdvisor/
   ```
2. Launch WoW and enable **BakerRang Advisor** in the AddOns list on the character select screen.

**Usage:**

1. Log in to your character
2. (Optional) Open your bank to capture bank contents — the addon automatically records items when the bank window opens
3. (Optional) Be in a zone with active world quests for richer world quest data
4. Type `/wowadvisor` in chat
5. A popup will appear with your character data as JSON — press **Ctrl+A** then **Ctrl+C** to copy it
6. Navigate to the WoW Advisor page on the site and look up your character
7. Click **Paste Addon Data** on the page — a "Saved to cloud ✓" badge confirms the data was embedded and stored in the vector database
8. Ask the AI anything — it will automatically retrieve the most relevant saved data per question

**Slash commands:**
| Command | Description |
|---|---|
| `/wowadvisor` | Collect in-game data and show the copy popup |
| `/wowadvisor zones` | Print your current zone's map ID to chat (useful for adding new zones to `SCAN_ZONES`) |
| `/wowadvisor tiersets` | Scan the encounter journal for tier set bonuses and show the result as markdown for pasting into `server/data/wow-tier-sets.md` |

**Adding new zone IDs:**

World quest zone IDs are defined in the `SCAN_ZONES` table at the top of `WoWAdvisor.lua`. If world quests in a new zone aren't being picked up, stand in that zone and run `/wowadvisor zones` to get the map ID, then add it to the table:
```lua
local SCAN_ZONES = {
  2248,  -- Isle of Dorn
  2214,  -- Ringing Deeps
  2215,  -- Hallowfall
  2255,  -- Azj-Kahet
  2437,  -- your new zone ID here
}
```

**Re-pasting to update:**

The addon data ages quickly (vault resets weekly, world quests change daily). Re-run `/wowadvisor` and paste again any time you want to refresh the AI's knowledge. Each paste overwrites the previous saved data for that character.

## Deploy

Both the server and client directories contain a Dockerfile that can be built and deployed.

For changes, build the image from either the server or client folder where the Dockerfile is: `docker build -t us-docker.pkg.dev/<kubernetes-project-id>/gcr.io/<image-name>:<version> .`

Push the image up to Google Registry. This requires access to the kubernetes project and gcloud authorization as well as
docker config settings updated to communicate with that project: `docker push us-docker.pkg.dev/<kubernetes-project-id>/gcr.io/<image-name>:<version>`
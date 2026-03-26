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

### First-Time Firestore Vector Index Setup

The vector search requires a composite index in Firestore. This only needs to be done once per project. Run:

```bash
curl -X POST \
  "https://firestore.googleapis.com/v1/projects/$(gcloud config get-value project)/databases/(default)/collectionGroups/resume_chunks/indexes" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "queryScope": "COLLECTION",
    "fields": [
      {
        "fieldPath": "embedding",
        "vectorConfig": {
          "dimension": 1536,
          "flat": {}
        }
      }
    ]
  }'
```

The index takes 1–5 minutes to build. Check its status with:
```bash
gcloud firestore indexes composite list
```

Wait until the status shows `READY` before running the ingestion script for the first time.

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
```

## Deploy

Both the server and client directories contain a Dockerfile that can be built and deployed.

For changes, build the image from either the server or client folder where the Dockerfile is: `docker build -t us-docker.pkg.dev/<kubernetes-project-id>/gcr.io/<image-name>:<version> .`

Push the image up to Google Registry. This requires access to the kubernetes project and gcloud authorization as well as
docker config settings updated to communicate with that project: `docker push us-docker.pkg.dev/<kubernetes-project-id>/gcr.io/<image-name>:<version>`
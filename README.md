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

## Deploy

Both the server and client directories contain a Dockerfile that can be built and deployed.

For changes, build the image from either the server or client folder where the Dockerfile is: `docker build -t gcr.io/<kubernetes-project-id>/<image-name>:<version> .`

Push the image up to Google Registry. This requires access to the kubernetes project and gcloud authorization as well as
docker config settings updated to communicate with that project: `docker push gcr.io/<kubernetes-project-id>/<image name>:<version>`
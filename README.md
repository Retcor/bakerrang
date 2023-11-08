A webapp frontend that interfaces with a node backend that serves as a learning playground for different technologies

## Local setup

Navigate to client directory and run `npm i`. Then, run `npm run dev` to start the client app using Vite.

Update the .env file with API keys for Elevenlabs and ChatGPT and then navigate to server directory and run `npm i`. 
Then, run `npm run start` to start the server app using Express.

## Deploy

Both the server and client directories contain a Dockerfile that can be built and deployed.

For changes, build the image from either the server or client folder where the Dockerfile is: `docker build -t gcr.io/<kubernetes-project-id>/<image-name>:<version> .`

Push the image up to Google Registry. This requires access to the kubernetes project and gcloud authorization as well as
docker config settings updated to communicate with that project: `docker push gcr.io/<kubernetes-project-id>/<image name>:<version>`
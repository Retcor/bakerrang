FROM node:20.9-alpine
WORKDIR /app
COPY package*.json ./
COPY . .
RUN npm install
CMD ["npm", "run", "start"]
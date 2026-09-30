FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY apps/launcher/package.json apps/launcher/package.json
COPY apps/storybook/package.json apps/storybook/package.json
COPY apps/polyglot/package.json apps/polyglot/package.json
COPY apps/sign/package.json apps/sign/package.json
COPY apps/budget/package.json apps/budget/package.json
COPY apps/passwords/package.json apps/passwords/package.json
COPY apps/account/package.json apps/account/package.json
COPY packages/web-tokens/package.json packages/web-tokens/package.json
COPY packages/web-theme/package.json packages/web-theme/package.json
COPY packages/web-auth/package.json packages/web-auth/package.json
COPY packages/web-api-client/package.json packages/web-api-client/package.json
COPY packages/web-ui/package.json packages/web-ui/package.json
COPY packages/web-app-shell/package.json packages/web-app-shell/package.json
RUN npm ci

FROM base AS build
COPY --from=dependencies /app/ ./
COPY . .

ARG APP
ARG VITE_API_BASE_URL
ARG VITE_OAUTH_TARGET
RUN if [ -z "$APP" ]; then echo >&2 "APP build argument is required"; exit 1; fi
RUN if [ -z "$VITE_API_BASE_URL" ]; then echo >&2 "VITE_API_BASE_URL build argument is required"; exit 1; fi
RUN if [ -z "$VITE_OAUTH_TARGET" ]; then echo >&2 "VITE_OAUTH_TARGET build argument is required"; exit 1; fi
RUN npm run build -w @bakerrang/web-$APP

FROM nginx:stable-alpine AS runner
ARG APP
COPY nginx/ /tmp/nginx/
RUN if [ -f "/tmp/nginx/apps/$APP.conf" ]; then cp "/tmp/nginx/apps/$APP.conf" /etc/nginx/conf.d/default.conf; else cp /tmp/nginx/nginx.conf /etc/nginx/conf.d/default.conf; fi && rm -rf /tmp/nginx && nginx -t
COPY --from=build /app/apps/$APP/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

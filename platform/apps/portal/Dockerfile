FROM node:24-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS dependencies

COPY package.json package-lock.json ./
COPY apps/portal/package.json apps/portal/package.json
COPY apps/site-renderer/package.json apps/site-renderer/package.json
COPY packages/site-components/package.json packages/site-components/package.json
COPY packages/site-schema/package.json packages/site-schema/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

FROM base AS builder

# Preserve root and workspace-local dependency layouts produced by npm ci.
COPY --from=dependencies /app/ ./
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL
ARG CUSTOM_DOMAIN_IPV4_ADDRESS
ARG CUSTOM_DOMAIN_CNAME_TARGET
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV CUSTOM_DOMAIN_IPV4_ADDRESS=${CUSTOM_DOMAIN_IPV4_ADDRESS}
ENV CUSTOM_DOMAIN_CNAME_TARGET=${CUSTOM_DOMAIN_CNAME_TARGET}

RUN if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]; then echo >&2 "NEXT_PUBLIC_API_BASE_URL build argument is required"; exit 1; fi
RUN npm run build -w @bakerrang/portal

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --home-dir /nonexistent --shell /usr/sbin/nologin nextjs

COPY --from=builder /app/apps/portal/.next/standalone ./
COPY --from=builder /app/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=builder /app/apps/portal/public ./apps/portal/public

USER nextjs
EXPOSE 8080

CMD ["node", "apps/portal/server.js"]

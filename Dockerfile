# syntax=docker/dockerfile:1

FROM ghcr.io/voidzero-dev/vite-plus:1.3.0 AS workspace
WORKDIR /app
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=vp:vp apps/frontend/package.json ./apps/frontend/package.json
COPY --chown=vp:vp apps/backend/package.json ./apps/backend/package.json

FROM workspace AS build
# Git hooks are unnecessary in an image. The build does not use tsx/esbuild.
RUN vp install --frozen-lockfile --ignore-scripts
COPY --chown=vp:vp tsconfig.json vite.config.ts ./
COPY --chown=vp:vp apps ./apps
RUN vp run build
RUN cp "$(vp env which node | head -1)" /tmp/node

FROM workspace AS production-dependencies
RUN vp install --frozen-lockfile --prod --ignore-scripts --filter @telemedi/backend

FROM debian:bookworm-slim AS backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app/apps/backend
COPY --from=build /tmp/node /usr/local/bin/node
COPY --from=production-dependencies /app/node_modules /app/node_modules
COPY --from=production-dependencies /app/apps/backend/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./package.json
COPY --from=build /app/apps/backend/dist ./dist
USER nobody
EXPOSE 3000
CMD ["node", "dist/index.js"]

FROM nginx:1.28-alpine AS frontend
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80

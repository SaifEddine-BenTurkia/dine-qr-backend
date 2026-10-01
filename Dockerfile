# syntax=docker/dockerfile:1.7

# ---- base: runtime OS packages shared by every stage -------------------------
FROM node:26-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- dependencies: full install, cached until the lockfile changes -----------
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- build: compile TypeScript and generate the Prisma client ----------------
FROM dependencies AS build
COPY prisma ./prisma
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---- migration: one-shot job that applies pending migrations -----------------
FROM build AS migration
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- production: only runtime dependencies and compiled output ---------------
FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

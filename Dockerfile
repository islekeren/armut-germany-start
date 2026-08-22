FROM node:20-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json .npmrc turbo.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

COPY . .

RUN npm --workspace=api run db:generate

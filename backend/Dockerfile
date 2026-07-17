# Context: ./backend (monorepo root). Builds the Medusa backend (apps/backend).
FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npx turbo build --filter=@dtc/backend

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/backend/.medusa/server ./
RUN npm ci --omit=dev

EXPOSE 9000
CMD ["npx", "medusa", "start"]

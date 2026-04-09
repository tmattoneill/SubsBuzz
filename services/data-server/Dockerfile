FROM node:18-alpine AS build

WORKDIR /app

RUN apk add --no-cache curl

# Install all deps (including devDeps for tsc)
COPY services/data-server/package*.json ./
RUN npm install

# Copy source and build
COPY services/data-server/ .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Install production deps only
COPY services/data-server/package*.json ./
RUN npm install --omit=dev

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S datauser -u 1001 -G nodejs
USER datauser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]

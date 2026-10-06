# Stage 1: Install dependencies
# Build context is the repo root (see docker-compose.yml).
FROM node:22-alpine AS deps
WORKDIR /app
COPY BE/package*.json ./
# tsx is in devDependencies but needed at runtime, so install all deps
# then prune in a later stage if needed
RUN npm ci

# Stage 2: Production image
FROM node:22-alpine
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY BE/ ./

# CI and local Docker both need FE public page catalog inside BE/
# (search/publicPages.ts loads ./publicPageCatalog when FE isn't on disk).
COPY FE/src/content/publicPages.ts ./search/publicPageCatalog.ts
COPY FE/src/content/resourcesTimeline.ts ./search/resourcesTimeline.ts

# Check the packaged catalog without access to the frontend source tree.
RUN node --import tsx -e "const { allPublicPages } = require('./search/publicPages.ts'); if (!allPublicPages().length) throw new Error('Public page catalog is empty');"

# Expose the backend port
EXPOSE 5000

# Start the Node.js server via tsx
CMD ["npm", "start"]

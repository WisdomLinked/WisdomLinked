# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# tsx is in devDependencies but needed at runtime, so install all deps
# then prune in a later stage if needed
RUN npm ci

# Stage 2: Production image
FROM node:22-alpine
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Expose the backend port
EXPOSE 5000

# Start the Node.js server via tsx
CMD ["npm", "start"]

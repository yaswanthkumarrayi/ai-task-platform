# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build (for type checking, linting etc.)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Security: create non-root user
RUN addgroup -S -g 1001 nodejs \
  && adduser -S -D -H -u 1001 -G nodejs appuser

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy application source
COPY --chown=appuser:nodejs . .

# Remove dev files
RUN rm -f .env .env.example .eslintrc.json

# Use non-root user
USER appuser

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/ready || exit 1

CMD ["node", "src/index.js"]

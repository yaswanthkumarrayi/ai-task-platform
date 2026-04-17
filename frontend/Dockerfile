# Stage 1: Build React app
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx (non-root)
FROM nginx:1.27-alpine AS runner

# Remove default nginx config and user
RUN rm -rf /etc/nginx/conf.d/default.conf

# Add non-root user
RUN addgroup -S -g 1001 nginxgroup \
  && adduser -S -D -H -u 1001 -G nginxgroup nginxuser

# Custom nginx config
COPY --chown=nginxuser:nginxgroup nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder --chown=nginxuser:nginxgroup /app/dist /usr/share/nginx/html

# Make nginx work without root
RUN chown -R nginxuser:nginxgroup /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown -R nginxuser:nginxgroup /var/run/nginx.pid

USER nginxuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]

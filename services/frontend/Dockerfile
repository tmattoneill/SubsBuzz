FROM node:18-alpine AS build

# Build-time env vars (Vite bakes these in at build time)
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_HERO_CDN_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_HERO_CDN_URL=$VITE_HERO_CDN_URL

# Set working directory
WORKDIR /app

# Copy package files
COPY services/frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source code
COPY services/frontend/ .

# Guard: VITE_HERO_CDN_URL is baked in at build time. If it's empty the frontend
# silently serves origin /hero-cache/ paths and bypasses Bunny CDN entirely. Warn
# loudly in the build log rather than shipping a CDN-less bundle unnoticed.
RUN if [ -z "$VITE_HERO_CDN_URL" ]; then \
      echo "⚠️  WARNING: VITE_HERO_CDN_URL is empty — hero images will be served from origin, NOT Bunny CDN."; \
      echo "⚠️  If this is a dev/prod build, pass it as a build arg (it comes from .env via docker-compose)."; \
    else \
      echo "✓ VITE_HERO_CDN_URL set to $VITE_HERO_CDN_URL"; \
    fi

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY services/frontend/nginx-global.conf /etc/nginx/nginx.conf
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx-user
RUN adduser -S nginx-user -u 1001 -G nginx-user

# Set permissions (include /tmp for pid and temp files)
RUN chown -R nginx-user:nginx-user /var/cache/nginx /var/log/nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
    && chown -R nginx-user:nginx-user /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp

# Switch to non-root user
USER nginx-user

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

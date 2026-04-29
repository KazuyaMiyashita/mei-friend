# Step 1: Build the monorepo
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

# Copy all files for monorepo build
COPY . .

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm run build-skiplint

# Step 2: Production image
FROM node:22-alpine

# Install Nginx (Alpine basic package)
RUN apk add --no-cache nginx

WORKDIR /app

# Copy the entire workspace from the builder to preserve pnpm symlinks
COPY --from=builder /app /app

# Copy built frontend static files to Nginx directory
RUN mkdir -p /usr/share/nginx/html && \
    cp -r /app/packages/web-app/dist/* /usr/share/nginx/html/

# Copy Nginx configuration
# Note: Standard Alpine nginx uses http.d directory
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy and setup the start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose the port Cloud Run expects (8080)
EXPOSE 8080

# Use the start script to run both Node and Nginx
CMD ["/app/start.sh"]

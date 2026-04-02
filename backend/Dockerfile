FROM node:20-slim

# Install Chromium dependencies + VNC + noVNC
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Chromium deps
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libxshmfence1 libx11-xcb1 \
    # VNC + noVNC
    x11vnc xvfb fluxbox \
    novnc websockify \
    # Utils
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all dependencies (including dev for TypeScript build)
COPY package.json package-lock.json ./
RUN npm ci

# Install Playwright Chromium
RUN npx playwright install chromium

# Copy source & build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove devDependencies after build
RUN npm prune --omit=dev

# Create data directories
RUN mkdir -p /app/data/browser-profile

# VNC + noVNC startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Ports: 3001=API, 6080=noVNC
EXPOSE 3001 6080

ENV PORT=3001
ENV HEADLESS=true
ENV DISPLAY=:99

ENTRYPOINT ["/docker-entrypoint.sh"]

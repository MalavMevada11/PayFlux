# ─── PayFlux API (root-level Dockerfile for Render) ─────────────────
# This Dockerfile is at the repo root but builds only the backend.
# ────────────────────────────────────────────────────────────────────

FROM node:20-slim

# Install Chromium and required fonts/libs for Puppeteer PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy only the backend package files first (for layer caching)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the backend source
COPY backend/ .

EXPOSE 4000

CMD ["node", "server.js"]

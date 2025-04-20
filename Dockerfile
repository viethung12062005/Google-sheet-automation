# 1) Build stage: cài dependencies Node
FROM node:18-slim AS build

WORKDIR /app

# Chép package.json và lockfile, cài dependencies
COPY package*.json ./
RUN npm install --production

# Chép toàn bộ source code
COPY . .

# 2) Runtime stage: cài Chromium và chạy app
FROM node:18-slim

WORKDIR /app

# Cài các thư viện system cần thiết để Puppeteer chạy headless Chromium
RUN apt-get update && apt-get install -y \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libc6 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libexpat1 \
      libfontconfig1 \
      libgbm1 \
      libgcc1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxcursor1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxi6 \
      libxrandr2 \
      libxrender1 \
      libxss1 \
      libxtst6 \
      wget \
      --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copy từ build stage
COPY --from=build /app /app

# Env cho Cloud Run
ENV PORT 8080

# Lệnh khởi động
CMD ["npm", "start"]

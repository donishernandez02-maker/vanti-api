FROM node:20-slim

ENV TZ=America/Bogota       PUPPETEER_SKIP_DOWNLOAD=false       PUPPETEER_CACHE_DIR=/usr/src/app/.cache/puppeteer

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y       ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0       libatk1.0-0 libatspi2.0-0 libc6 libcairo2 libcups2 libdbus-1-3       libexpat1 libfontconfig1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4       libnss3 libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1       libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2       libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils       && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 8080

CMD ["npm", "start"]

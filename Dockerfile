FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    HOME=/home/node \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CONTAINERIZED=true \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

# Install a virtual display for headed jobs, Chrome for the "chrome" engine,
# and an init process so browser child processes are reaped correctly.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg gosu tini xauth xvfb \
    && install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
      | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
      > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Browser binaries are installed at build time, so a freshly deployed container
# does not need to download them before it can accept requests.
RUN npm ci --omit=dev \
    && npx playwright install --with-deps chromium firefox \
    && npx camoufox-js fetch \
    && mkdir -p /app/data /app/profile /app/scripts /app/scripts-default /opt/camoufox-cache-default \
    && cp -a /home/node/.cache/camoufox/. /opt/camoufox-cache-default/ \
    && chown -R node:node /app /home/node /ms-playwright /opt/camoufox-cache-default

COPY --chown=node:node . ./
COPY --chown=node:node scripts/ /app/scripts-default/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24 -ac +extension RANDR", "node", "server.js"]

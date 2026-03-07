FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY mcp/package.json mcp/

RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

USER node

HEALTHCHECK --interval=30s --timeout=5s CMD pgrep -f 'node mcp/dist/index.js' || exit 1

CMD ["node", "mcp/dist/index.js"]

FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY mcp/package.json mcp/

RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

USER node

CMD ["node", "mcp/dist/index.js"]

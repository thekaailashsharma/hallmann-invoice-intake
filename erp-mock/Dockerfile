FROM node:20-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
USER node
CMD ["node", "server.js"]

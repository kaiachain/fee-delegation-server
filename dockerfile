# Use the correct Node.js version as specified in .nvmrc
FROM node:22.23.1-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY backend/prisma ./backend/prisma

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client and build the application
RUN npm run db:generate
RUN npm run build

# Production stage
FROM node:22.23.1-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .env.production ./.env.production

# Install dependencies (prisma generate needs the prisma CLI from
# devDependencies; Node 22's bundled npm still ships vulnerable tar).
RUN npm install && npm cache clean --force

# Copy built application
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/backend ./backend
COPY --from=build /app/lib ./lib
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=build /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Generate Prisma client, then drop the base-image npm (and its tar@7.5.11
# CVE-2026-59873) — runtime only needs node.
RUN ./node_modules/.bin/prisma generate --schema=./backend/prisma/schema.prisma \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application (equivalent to `npm run start`)
CMD ["node", "server.js"]
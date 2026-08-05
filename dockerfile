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

# Production deps only (dev tooling like jest/nodemon/tailwind stays out of
# the runtime image). Prisma client is copied from the build stage below.
#
# The prisma CLI is a devDependency but the deployment's migration init
# container needs it at runtime, so install it explicitly here. The version is
# read from package-lock.json rather than the package.json range, because the
# CLI and @prisma/client must be the same version and the lock is what pinned
# the client. --omit=dev keeps the rest of the dev tree out. Installing while
# npm still exists lets npm resolve the CLI's hoisted dependencies and create
# node_modules/.bin/prisma; hand-picking COPY lines for that tree is fragile
# across prisma versions.
#
# Node 22's bundled npm still ships vulnerable tar — remove it after install,
# so nothing here may be invoked via npm/npx at runtime. See the migration
# command in the k8s manifest: it must call the CLI directly, e.g. 
#   node node_modules/prisma/build/index.js migrate deploy --schema=./backend/prisma/schema.prisma
RUN npm install --omit=dev \
  && npm install --omit=dev --no-save \
     "prisma@$(node -p 'require("./package-lock.json").packages["node_modules/prisma"].version')" \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy built application + generated Prisma client
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/backend ./backend
COPY --from=build /app/lib ./lib
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=build /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application (equivalent to `npm run start`)
CMD ["node", "server.js"]
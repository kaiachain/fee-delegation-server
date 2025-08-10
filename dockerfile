# Use the correct Node.js version as specified in .nvmrc
FROM node:22.5.1-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY backend/prisma ./backend/prisma

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client and build the application
RUN npm run db:generate
RUN npm run build

# Production stage
FROM node:22.5.1-alpine AS production

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/backend ./backend
COPY --from=build --chown=nextjs:nodejs /app/lib ./lib
COPY --from=build --chown=nextjs:nodejs /app/server.js ./server.js
COPY --from=build --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=build --chown=nextjs:nodejs /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=build --chown=nextjs:nodejs /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=build --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Generate Prisma client in production
RUN npm run db:generate

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "run", "start"]
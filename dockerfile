# Use the correct Node.js version as specified in .nvmrc
FROM node:22.5.1-alpine AS build

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
FROM node:22.5.1-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install && npm cache clean --force

# Copy built application
COPY --from=build /app/.env.production ./.env.production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/backend ./backend
COPY --from=build /app/lib ./lib
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=build /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Generate Prisma client in production
RUN npm run db:generate

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
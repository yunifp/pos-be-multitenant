# Stage 1: Build stage
FROM node:18-slim AS builder

# Install openssl yang dibutuhkan Prisma
RUN apt-get update && apt-get install -y openssl

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
COPY . .
RUN npx prisma generate
RUN rm -rf dist && npm run build

# Stage 2: Production stage
FROM node:18-slim AS runner
# Install openssl di stage runner juga
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
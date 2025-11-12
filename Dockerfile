# Multi-stage build for AI Travel Planner (frontend + backend)

# 1) Build frontend (Vite)
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:frontend

# 2) Build backend (TypeScript)
FROM node:20-alpine AS backend
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# 3) Runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Copy built server and frontend assets
COPY --from=backend /app/dist ./dist
COPY --from=frontend /app/dist ./dist
# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Expose API port
EXPOSE 3000
# Provide overridable runtime config via env (JWT_SECRET, LOG_LEVEL, REQUEST_LOG)
CMD ["node", "dist/api/server.js"]
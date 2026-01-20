FROM node:20-alpine

# Install FFmpeg for voice message processing
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN pnpm run build

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Create logs directory
RUN mkdir -p /app/logs

# Set environment
ENV NODE_ENV=production

# Start bot
CMD ["node", "dist/index.js"]

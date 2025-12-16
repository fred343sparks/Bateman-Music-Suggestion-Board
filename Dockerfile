# Multi-stage build for Node.js application
FROM node:24-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .
ENV PORT=8080

# Expose port used by Cloud Run
EXPOSE 8080

# Health check (uses PORT env var; Cloud Run will override at runtime)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http'); http.get('http://localhost:'+ (process.env.PORT||8080), res=>{ if (res.statusCode<200 || res.statusCode>=300) process.exit(1); else process.exit(0); }).on('error',()=>process.exit(1))"

# Start application
CMD ["npm", "start"]

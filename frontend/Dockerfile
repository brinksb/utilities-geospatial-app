FROM node:20-slim

WORKDIR /app

# Install system dependencies for Playwright and curl for healthcheck
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install

# Install Playwright browsers for E2E tests
RUN npx playwright install --with-deps chromium

# Copy application code
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

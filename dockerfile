# Use Node.js 20
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 2000

# Start server
CMD ["node", "dist/index.js"]

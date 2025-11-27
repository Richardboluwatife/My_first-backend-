FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (includes TypeScript)
RUN npm install

# Copy the rest of the code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 2000

# Run the compiled JS
CMD ["npm", "run", "start"]
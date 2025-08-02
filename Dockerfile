FROM node:current-alpine

WORKDIR /app

# Copy package.json files first for better caching
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install 

# Then copy the rest of the application code
COPY . .

# Try building with correct directory context
RUN cd /app/client && npm run build && cd ../..

RUN cd /app && npm rebuild bcrypt --update-binary


# Default command (will be overridden in Kubernetes)
# Note: Alpine doesn't have bash by default, so use sh
CMD ["sh"]
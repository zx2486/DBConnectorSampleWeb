FROM node:current-alpine

WORKDIR /app

# Install dependencies for all subprojects
RUN cd client && npm install && cd ..
RUN npm install

# Bundle app source
COPY . /app

# Default command (will be overridden in Kubernetes)
CMD ["bash"]
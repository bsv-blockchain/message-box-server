# Use Node 20 Alpine base
FROM node:20-alpine

# Install necessary packages (nginx, openssl, etc.)
RUN echo "http://dl-4.alpinelinux.org/alpine/v3.3/main" >> /etc/apk/repositories && \
    apk add --no-cache --update nginx && \
    chown -R nginx:www-data /var/lib/nginx

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (including dotenv!)
RUN npm install

# Install global tools (optional, depends on how you're running knex)
RUN npm install -g knex typescript

# Copy remaining source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Copy compiled knexfile.js to /app root (where imports like '../../knexfile.js' expect it)
RUN echo "Copying knexfile.js to /app..." \
 && ls -l out/knexfile.js \
 && cp out/knexfile.js ./knexfile.js

# Copy nginx config
COPY ./nginx.conf /etc/nginx/nginx.conf

# Expose the API port
EXPOSE 8080

# Start the app
CMD [ "node", "out/src/index.js" ]

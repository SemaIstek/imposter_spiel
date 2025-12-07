FROM node:18-alpine

# Create app directory and copy project
WORKDIR /app

# Only copy package files first for better caching
COPY project/package.json project/package-lock.json ./project/

WORKDIR /app/project

RUN npm install --production

# Copy the rest of the project
COPY project/ ./

EXPOSE 8080

CMD ["node", "server.js"]

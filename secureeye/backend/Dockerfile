FROM node:18-alpine

WORKDIR /app

# Copy workspace root
COPY ../package.json ../package-lock.json* ./
COPY ../shared ./shared

# Copy backend
COPY package.json ./backend/
COPY src ./backend/src
COPY tsconfig.json ./backend/

# Install dependencies
RUN npm install --workspace=backend

# Build shared
RUN npm run build --workspace=shared

# Build backend
RUN npm run build --workspace=backend

WORKDIR /app/backend

EXPOSE 3000 3001

CMD ["node", "dist/index.js"]

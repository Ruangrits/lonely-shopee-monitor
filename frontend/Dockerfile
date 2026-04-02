FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve static files with lightweight server
FROM node:20-slim
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/build ./build

EXPOSE 5173
CMD ["serve", "build", "-l", "5173", "-s"]

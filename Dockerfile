# Business Minded — Sprint 1 Docker image
FROM node:20-alpine AS base

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]

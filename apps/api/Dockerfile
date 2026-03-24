FROM node:20-bookworm-slim

WORKDIR /app

COPY . .

RUN npm ci
RUN npm run -w api build

EXPOSE 4000

WORKDIR /app/apps/api

CMD ["sh", "-c", "npx prisma db push && npm run start:prod"]

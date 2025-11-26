# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=4000
EXPOSE 4000
CMD ["npm","start"]

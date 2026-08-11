# Portable container — runs the same way anywhere (Railway, Fly, a VM, etc.)
FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8787
EXPOSE 8787
CMD ["npm", "start"]

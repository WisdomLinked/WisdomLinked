# Wisdom Document System - Backend
FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4001

CMD ["npm", "start"]

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY app ./app
COPY next.config.mjs tsconfig.json ./
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

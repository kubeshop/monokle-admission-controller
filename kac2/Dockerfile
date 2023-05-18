FROM node:18.16.0-bullseye-slim

WORKDIR /workdir
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .

CMD ["npm", "run", "prod"]
EXPOSE 3000

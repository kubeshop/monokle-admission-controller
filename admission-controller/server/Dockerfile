FROM node:18.16.0-bullseye-slim

WORKDIR /workdir
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY ./src ./src
COPY ./tsconfig.json ./

CMD ["npm", "run", "prod"]
EXPOSE 8443

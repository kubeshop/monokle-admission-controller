FROM node:18.16.0-bullseye-slim

WORKDIR /workdir
COPY admission-webhook/package*.json ./
RUN npm ci --ignore-scripts

COPY ./admission-webhook/src ./src
COPY ./admission-webhook/tsconfig.json ./

CMD ["npm", "run", "prod"]
EXPOSE 8443

FROM node:18.16.0-bullseye-slim

WORKDIR /workdir
COPY kac-api/package*.json ./
RUN npm ci --ignore-scripts

COPY ./kac-api/src ./src
COPY ./kac-api/tsconfig.json ./

CMD ["npm", "run", "prod"]
EXPOSE 8443

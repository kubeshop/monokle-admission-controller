FROM node:18.16.0-bullseye-slim

WORKDIR /workdir
COPY admission-controller/server/package*.json ./
RUN npm ci --ignore-scripts

COPY ./admission-controller/server/src ./src
COPY ./admission-controller/server/tsconfig.json ./

CMD ["npm", "run", "prod"]
EXPOSE 8443

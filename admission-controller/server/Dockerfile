ARG BUILD_IMAGE="node:20.9-alpine3.18"
ARG PRODUCTION_IMAGE="node:20.9-alpine3.18"

#####################
# Compile container
#####################
FROM $BUILD_IMAGE AS compileContainer

WORKDIR /build

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build


#####################
# Final container
#####################
FROM $PRODUCTION_IMAGE

LABEL AUTHOR="Krzysztof Krztoń <krzysztof@kubeshop.io>"
LABEL DESCRIPTION="Monokle Admission Controller - Server Container"

WORKDIR /service

COPY package*.json ./
COPY --from=compileContainer /build/dist .

RUN npm ci --only=production --ignore-scripts

CMD ["/usr/local/bin/node", "index.js"]
EXPOSE 8443

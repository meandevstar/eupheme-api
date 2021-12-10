# Dockerfile used for production

FROM node:16.9.1-alpine

RUN apk --update add bash && \
    apk add --no-cache dos2unix python3 py3-pip jq git make file nginx && \
    pip3 install --upgrade pip && \
    pip3 install awscli && \
    rm -rf /var/cache/apk/*
RUN aws --version
RUN file --version

RUN yarn global add pm2
RUN yarn global add concurrently

WORKDIR /app

COPY ./package.json ./package.json
COPY ./yarn.lock ./yarn.lock
COPY ./tsconfig.json ./tsconfig.json
COPY .creds ./.creds
COPY src ./src

RUN yarn install --frozen-lockfile
RUN yarn build

COPY ./entrypoint.sh ./entrypoint.sh
COPY ./.nginx/nginx.conf /etc/nginx

RUN chmod +x ./entrypoint.sh
RUN dos2unix ./entrypoint.sh

ENV NODE_ENV production

EXPOSE 9001

ENTRYPOINT /bin/bash -x ./entrypoint.sh

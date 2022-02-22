FROM alpine
USER root
WORKDIR /app
RUN apk update
RUN apk add certbot
RUN apk add openssl
RUN apk add --update nodejs npm
COPY package.json /app
RUN npm install --verbose
COPY . /app
RUN export MSYS_NO_PATHCONV=1
CMD  npm start
#!/usr/bin/env sh

export EMAIL=lucas.vbotelho83@gmail.com;
export PROJECT=botelho;
export DNS=botelho.club;
docker-compose build;
docker-compose up -d --force-recreate
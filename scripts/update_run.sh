#!/usr/bin/env sh

git pull;
docker-compose build;
docker-compose up -d --force-recreate;
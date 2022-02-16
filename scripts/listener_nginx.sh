#!/usr/bin/env sh

while true
do
       touch  ./lastwatch
       sleep 5
       find ./listener -cnewer ./lastwatch -exec bash -c 'echo "################################## Reloading nginx" && nginx -s stop && nginx -s start' - {} \; 
done
#!/usr/bin/env sh

while true
do
       touch  ./lastwatch
       sleep 5
       find /etc/nginx/conf.d -cnewer ./lastwatch -exec bash -c 'echo "################################## Reloading nginx" && nginx -s reload' - {} \; 
done
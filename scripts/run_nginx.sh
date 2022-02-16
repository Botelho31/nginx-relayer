#!/usr/bin/env sh

if test -f "./etc/letsencrypt/live/${DOMAIN}/privkey.pem"; then
    echo "################################## Certificates Found"
else 
    echo "################################## Creating Dummy Certificates"
    mkdir -p /etc/letsencrypt/live/${DOMAIN}
    touch /etc/letsencrypt/live/${DOMAIN}/dummycertificate.txt
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem -out /etc/letsencrypt/live/${DOMAIN}/fullchain.pem -subj "/C=BR/ST=Brasilia/L=AsaNorte/O=${PROJECT} /OU=IT Department/CN=${DOMAIN}"
fi
echo "################################## Create File Listener"
./src/scripts/listener_nginx.sh &

echo "################################## Run nginx"
export DOLLAR='$'
envsubst < ./src/nginx-conf/nginx.conf > /etc/nginx/conf.d/default.conf # /etc/nginx/conf.d/default.conf
nginx -g "daemon off;"
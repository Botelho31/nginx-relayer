#!/usr/bin/env sh

if test -f "/etc/letsencrypt/live/${DOMAIN}/dummycertificate.txt"; then
    echo "################################## Dummy Certificate Found"
    rm -rf /etc/letsencrypt/live/${DOMAIN}
fi

echo "################################## Run Certbot"
if certbot certonly --webroot --webroot-path=/var/www/html --email ${EMAIL} --agree-tos --noninteractive --no-eff-email -d ${DOMAIN}; then
    echo "################################## Reload Nginx"
    touch /listener/reloadnginx
fi



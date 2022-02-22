echo "################################## Create File Listener"
./scripts/listener_nginx.sh &

echo "################################## Run nginx"
chmod -R 755 /etc/nginx/conf.d/* 
nginx -g "daemon off;"
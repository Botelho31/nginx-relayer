echo "################################## Create File Listener"
./scripts/listener_nginx.sh &

echo "################################## Run nginx"
nginx -g "daemon off;"
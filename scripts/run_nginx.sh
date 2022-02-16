echo "################################## Create File Listener"
./src/scripts/listener_nginx.sh &

echo "################################## Run nginx"
nginx -g "daemon off;"
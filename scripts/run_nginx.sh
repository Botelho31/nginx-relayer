echo "################################## Create File Listener"
./src/scripts/listener_nginx.sh &

echo "################################## Run nginx"
mkdir /challenge
nginx -g "daemon off;"
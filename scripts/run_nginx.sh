echo "################################## Create File Listener"
./src/scripts/listener_nginx.sh &

echo "################################## Run nginx"
export DOLLAR='$'
envsubst < ./src/nginx-conf/nginx.conf > /etc/nginx/conf.d/default.conf # /etc/nginx/conf.d/default.conf
nginx -g "daemon off;"
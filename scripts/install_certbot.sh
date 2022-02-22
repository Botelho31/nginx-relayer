#!/usr/bin/env sh

sudo snap install core; 
sudo snap refresh core;
sudo snap install --classic certbot;
ln -s /snap/bin/certbot /usr/bin/certbot;
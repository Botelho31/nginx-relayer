import fs from 'fs'
import path from 'path'

import { RelayConfig } from './domain/model/relay-config'

const relayConfig = require('../relay-config.json') as RelayConfig[]
const pathToConfig = path.join(__dirname, '../build/default.conf')

function addHttpServer(serverName: String, relay: String, acmeChallenge: boolean, httpsPass: boolean) {
  let httpText = fs.readFileSync(path.join(__dirname, 'nginx-conf/http.txt'), 'utf8')
  httpText += `\nserver_name ${serverName};\n`
  if (acmeChallenge) {
    const acmeText = fs.readFileSync(path.join(__dirname, 'nginx-conf/acme-challenge.txt'), 'utf8')
    httpText += acmeText
  }
  if (httpsPass) {
    const httpsPass = fs.readFileSync(path.join(__dirname, 'nginx-conf/https-pass.txt'), 'utf8')
    httpText += httpsPass
  } else {
    httpText += 
      `location / {
          proxy_pass http://${relay}
        }
      `
  }
  httpText += '}'

  fs.appendFileSync(pathToConfig, httpText)
}

function addHttpsServer(serverName: String, relay: String) {
  let httpsText = fs.readFileSync(path.join(__dirname, 'nginx-conf/https.txt'), 'utf8')
  httpsText += 
      ` server_name ${serverName};
        ssl_dhparam /etc/ssl/certs/dhparam-2048.pem;
        ssl_certificate /etc/letsencrypt/live/botelho.club/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/botelho.club/privkey.pem;

        location / {
                proxy_pass http://${serverName}/;
                proxy_buffering on;
        }
      }
    `
  fs.appendFileSync(pathToConfig, httpsText)
}

function main() {
  fs.openSync(pathToConfig, 'w')
  for(let i = 0;i < relayConfig.length; i+= 1) {
    addHttpServer(relayConfig[i].servername , relayConfig[i].relay, relayConfig[i].acmeChallenge, relayConfig[i].httpsPass)
    if (relayConfig[i].https) {
      addHttpsServer(relayConfig[i].servername, relayConfig[i].relay)
    }
  }
}

main()
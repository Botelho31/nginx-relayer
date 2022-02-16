import fs from 'fs'
import path from 'path'
import util from 'util'
import { exec } from 'child_process'
const execPromise = util.promisify(exec);

import { ServerConfig } from './domain/model/server-config'
import GreenlockHelper from './infra/greenlock-helper'

const serverConfig = require('../relay-config.json') as ServerConfig
const pathToConfig = path.join(__dirname, '../build/conf/default.conf')

function createDir(relativePath: string) {
  const dir = path.join(__dirname, relativePath)
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
}

function addHttpServer(serverName: String, relay: String, certificate: boolean, httpsPass: boolean) : String {
  let httpText = fs.readFileSync(path.join(__dirname, 'nginx-conf/http.txt'), 'utf8')
  httpText += `\nserver_name ${serverName};\n`
  if (certificate) {
    const acmeText = fs.readFileSync(path.join(__dirname, 'nginx-conf/acme-challenge.txt'), 'utf8')
    httpText += acmeText
  }
  if (httpsPass) {
    const httpsPass = fs.readFileSync(path.join(__dirname, 'nginx-conf/https-pass.txt'), 'utf8')
    httpText += httpsPass
  } else {
    httpText += 
      ` location / {
          proxy_pass http://${relay.replace('localhost', 'host.docker.internal')};
          proxy_buffering on;
        }
      `
  }
  httpText += '}\n'

  return httpText
}

function addHttpsServer(serverName: String, relay: String) : String {
  let httpsText = fs.readFileSync(path.join(__dirname, 'nginx-conf/https.txt'), 'utf8')
  httpsText += 
      ` server_name ${serverName};
        ssl_dhparam /etc/ssl/certs/dhparam-2048.pem;
        ssl_certificate /etc/letsencrypt/live/${serverName}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${serverName}/privkey.pem;

        location / {
                proxy_pass http://${relay.replace('localhost', 'host.docker.internal')}/;
                proxy_buffering on;
        }
      }\n
    `
  return httpsText
}

async function main() {
  createDir('../build')
  createDir('../build/conf')
  fs.openSync(pathToConfig, 'w')
  const greenlock =  new GreenlockHelper(serverConfig.contactEmail)
  let nginxConf = ""
  const relays = serverConfig.relays
  for(let i = 0;i < relays.length; i+= 1) {
    nginxConf += addHttpServer(relays[i].serverName , relays[i].relay, relays[i].https, relays[i].forceHttps)
    if (relays[i].https) {
      nginxConf += addHttpsServer(relays[i].serverName, relays[i].relay)
      createDir('../build/dhparam/')
      createDir('../build/certificates/')
      if (!fs.existsSync(path.join(`..build/certificates/${relays[i].serverName}`))) {
        createDir(`../build/certificates/${relays[i].serverName}`)
        const certificatePath = path.join(`build/certificates/${relays[i].serverName}`)
        console.log(`Creating Dummy Certificates for ${relays[i].serverName}`)
        await execPromise(`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ${certificatePath}/privkey.pem -out ${certificatePath}/fullchain.pem -subj "/C=${serverConfig.address.country}/ST=${serverConfig.address.city}/L=${serverConfig.address.neighborhood}/O=${serverConfig.project} /OU=IT Department/CN=${relays[i].serverName}"`);
      }
      const dhparamPath = path.join(__dirname, '../build/dhparam/dhparam-2048.pem')
      if (!fs.existsSync(dhparamPath)) {
        fs.writeFileSync(dhparamPath, require("dhparam")())
      }
    }
  }
  fs.appendFileSync(pathToConfig, nginxConf)
}

main()
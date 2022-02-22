import fs from 'fs'
import path from 'path'
import { ServerConfig } from './domain/model/server-config'
import cron from 'node-cron'
import { check } from 'tcp-port-used'
import CertbotHelper from './infra/certbot-helper'
import { execProcess } from './utils/general'

const serverConfig = require('../relay-config.json') as ServerConfig
const pathToConfig = path.join(__dirname, '../build/conf/default.conf')

function reloadNginx () {
  const pathToReload = path.join(__dirname, '../build/conf/reload')
  if (fs.existsSync(pathToReload)) {
    fs.unlinkSync(pathToReload)
  }
  fs.writeFileSync(path.join(__dirname, '../build/conf/reload'), '')
}

function createDir (relativePath: string) {
  const dir = path.join(__dirname, relativePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
}

function addHttpServer (serverName: String, relay: String, certificate: boolean, httpsPass: boolean) : String {
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
          proxy_set_header Host $host;
          proxy_set_header Access-Control-Allow-Origin *;
        }
      `
  }
  httpText += '}\n'

  return httpText
}

function addHttpsServer (serverName: String, relay: String) : String {
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

async function checkForPortUsage (port: number) : Promise<Boolean> {
  const result = await check(port, 'webserver')
  return result
}

async function certificateCheck () {
  console.log('# Checking for certificates')
  const relays = serverConfig.relays
  for (let i = 0; i < relays.length; i += 1) {
    if (relays[i].https && fs.existsSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/temporary`))) {
      console.log(`${relays[i].serverName} - # Relay has temporary certificate`)
      const httpsInUse = await checkForPortUsage(443)
      const httpInUse = await checkForPortUsage(80)
      if (httpInUse && httpsInUse) {
        console.log(`${relays[i].serverName} - # Creating full certificate`)
        await certbot.getCertificate(relays[i].serverName)
        fs.unlinkSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/temporary`))
        reloadNginx()
        console.log(`${relays[i].serverName} - # Full certificate created, reloading NGINX`)
      } else {
        console.log(`${relays[i].serverName} - # Servers not open for certificate creation`)
      }
    }
  }
}

const certbot = new CertbotHelper(serverConfig.contactEmail)

const checkForCertificates = cron.schedule('0 * * * * *', async () => {
  await certificateCheck()
}, {
  scheduled: false
})

const renewCertificates = cron.schedule('0 0 1 * *', async () => {
  console.log('# Renewing certificates')
  await certbot.renew(serverConfig.relays)
  reloadNginx()
}, {
  scheduled: false
})

async function main () {
  createDir('../build')
  createDir('../build/conf')
  fs.writeFileSync(pathToConfig, '')
  let nginxConf = ''
  const relays = serverConfig.relays
  console.log('# Creating Relays Config')
  for (let i = 0; i < relays.length; i += 1) {
    nginxConf += addHttpServer(relays[i].serverName, relays[i].relay, relays[i].https, relays[i].forceHttps)
    if (relays[i].https) {
      nginxConf += addHttpsServer(relays[i].serverName, relays[i].relay)
      createDir('../build/dhparam/')
      createDir('../build/certificates/')
      if (!fs.existsSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}`))) {
        createDir(`../build/certificates/${relays[i].serverName}`)
        const certificatePath = path.join(`build/certificates/${relays[i].serverName}`)
        console.log(`${relays[i].serverName} - # Creating Dummy Certificates`)
        await execProcess('openssl', ['req', '-x509', '-nodes', '-days', '365', '-newkey', 'rsa:2048', '-keyout', `${certificatePath}/privkey.pem`, '-out', `${certificatePath}/fullchain.pem`, '-subj', `"/C=${serverConfig.address.country}/ST=${serverConfig.address.city}/L=${serverConfig.address.neighborhood}/O=${serverConfig.project}/OU=IT-Department/CN=${relays[i].serverName}"`])
        fs.writeFileSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/temporary`), '')
      }
    }
  }
  const dhparamPath = path.join(__dirname, '../build/dhparam/dhparam-2048.pem')
  if (!fs.existsSync(dhparamPath)) {
    console.log('# Creating DHParam')
    await execProcess('openssl', ['dhparam', '-out', dhparamPath, '2048'])
  }
  console.log('# Finished Relays Config')
  createDir('../build/challenge')
  fs.appendFileSync(pathToConfig, nginxConf)
  reloadNginx()

  await certificateCheck()
  checkForCertificates.start()
  renewCertificates.start()
}

main()

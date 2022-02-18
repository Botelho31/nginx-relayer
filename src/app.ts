import fs from 'fs'
import path from 'path'
import util from 'util'
import { exec } from 'child_process'
import { ServerConfig } from './domain/model/server-config'
import net from 'net'
import cron from 'node-cron'
import GreenlockHelper from './infra/greenlock-helper'

const execPromise = util.promisify(exec)
const server = net.createServer()

const serverConfig = require('../relay-config.json') as ServerConfig
const pathToConfig = path.join(__dirname, '../build/conf/default.conf')

function reloadNginx () {
  const pathToReload = path.join(__dirname, '../build/conf/reload')
  if (fs.existsSync(pathToReload)) {
    fs.unlinkSync(pathToReload)
  }
  fs.openSync(path.join(__dirname, '../build/conf/reload'), 'w')
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
  return new Promise((resolve) => {
    server.once('error', function (err: any) {
      if (err.code === 'EADDRINUSE') {
        // port is currently in use
        resolve(true)
      }
    })

    server.once('listening', function () {
      // close the server if listening doesn't fail
      server.close()
      resolve(false)
    })

    server.listen(port)
  })
}

const checkForCertificates = cron.schedule('0 * * * * *', async () => {
  console.log('Checking for certificates')
  const relays = serverConfig.relays
  const greenlock = new GreenlockHelper(serverConfig.contactEmail)
  for (let i = 0; i < relays.length; i += 1) {
    if (relays[i].https && fs.existsSync(path.join(`..build/certificates/${relays[i].serverName}/temporary`))) {
      const httpsInUse = await checkForPortUsage(443)
      const httpInUse = await checkForPortUsage(80)
      if (httpInUse && httpsInUse) {
        const certificate = await greenlock.getCertificate(relays[i].serverName)
        fs.writeFileSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/fullchain.pem`), certificate.fullchain)
        fs.writeFileSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/privkey.pem`), certificate.privkey)
        fs.unlinkSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/temporary`))
        reloadNginx()
      }
    }
  }
}, {
  scheduled: false
})

async function main () {
  createDir('../build')
  createDir('../build/conf')
  fs.openSync(pathToConfig, 'w')
  let nginxConf = ''
  const relays = serverConfig.relays
  for (let i = 0; i < relays.length; i += 1) {
    nginxConf += addHttpServer(relays[i].serverName, relays[i].relay, relays[i].https, relays[i].forceHttps)
    if (relays[i].https) {
      nginxConf += addHttpsServer(relays[i].serverName, relays[i].relay)
      createDir('../build/dhparam/')
      createDir('../build/certificates/')
      if (!fs.existsSync(path.join(__dirname, `..build/certificates/${relays[i].serverName}`))) {
        createDir(`../build/certificates/${relays[i].serverName}`)
        const certificatePath = path.join(`build/certificates/${relays[i].serverName}`)
        console.log(`Creating Dummy Certificates for ${relays[i].serverName}`)
        await execPromise(`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ${certificatePath}/privkey.pem -out ${certificatePath}/fullchain.pem -subj "/C=${serverConfig.address.country}/ST=${serverConfig.address.city}/L=${serverConfig.address.neighborhood}/O=${serverConfig.project} /OU=IT Department/CN=${relays[i].serverName}"`)
        fs.openSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/temporary`), 'w')
        reloadNginx()
      }
      const dhparamPath = path.join(__dirname, '../build/dhparam/dhparam-2048.pem')
      if (!fs.existsSync(dhparamPath)) {
        fs.writeFileSync(dhparamPath, require('dhparam')())
        reloadNginx()
      }
    }
  }
  checkForCertificates.start()
  fs.appendFileSync(pathToConfig, nginxConf)
}

main()

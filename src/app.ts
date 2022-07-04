import fs from 'fs'
import path from 'path'
import { ServerConfig } from './domain/model/server-config'
import cron from 'node-cron'
import { check } from 'tcp-port-used'
import CertbotHelper from './infra/certbot-helper'
import { execProcess, log } from './utils/general'
import { RelayConfig } from './domain/model/relay-config'
import lodash from 'lodash'

const pathToConfig = path.join(__dirname, '../build/conf/default.conf')
const pathToReload = path.join(__dirname, '../build/conf/reload')
const pathToRelayConfig = path.join(__dirname, '../relay-config.json')
if (!fs.existsSync(pathToRelayConfig)) {
  log('Relay Config Must Exist, terminating program')
  process.exit()
}
let currentServerConfig = JSON.parse(fs.readFileSync(pathToRelayConfig, { encoding: 'utf8' })) as ServerConfig

function reloadNginx () {
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

function addHttpServer (relay: RelayConfig) : String {
  let httpText = fs.readFileSync(path.join(__dirname, 'nginx-conf/http.txt'), 'utf8')
  httpText += `\nserver_name ${relay.serverName};\n`
  if (relay.https) {
    const acmeText = fs.readFileSync(path.join(__dirname, 'nginx-conf/acme-challenge.txt'), 'utf8')
    httpText += acmeText
  }
  if (relay.forceHttps) {
    const httpsPass = fs.readFileSync(path.join(__dirname, 'nginx-conf/https-pass.txt'), 'utf8')
    httpText += httpsPass
  } else {
    if (relay.staticServer) {
      httpText +=
      ` root /var/www/html/${relay.serverName};
        index index.html index.htm index.nginx-debian.html;

        location / {
            # First attempt to serve request as file, then
            # as directory, then fall back to redirecting to index.html
            try_files $uri $uri/ /index.html;
        }

        # # Media: images, icons, video, audio, HTC
        location ~* \\.(?:jpg|jpeg|gif|png|ico|cur|gz|svg|svgz|mp4|ogg|ogv|webm|htc)$ {
          expires 1M;
          access_log off;
          add_header Cache-Control "public";
        }

        # # Javascript and CSS files
        location ~* \\.(?:css|js)$ {
            try_files $uri =404;
            expires 1y;
            access_log off;
            add_header Cache-Control "public";
        }

        # # Any route containing a file extension (e.g. /devicesfile.js)
        location ~ ^.+\\..+$ {
            try_files $uri =404;
        }
      `
    } else {
      httpText +=
      ` location / {
          proxy_pass http://${relay.relay.replace('localhost', 'host.docker.internal')};
          proxy_buffering on;
          proxy_set_header Host            $host;
          proxy_set_header X-Forwarded-For $remote_addr;
        }
      `
    }
  }
  httpText += '}\n'

  return httpText
}

function addHttpsServer (relay: RelayConfig) : String {
  let httpsText = fs.readFileSync(path.join(__dirname, 'nginx-conf/https.txt'), 'utf8')
  httpsText +=
      ` server_name ${relay.serverName};
        ssl_dhparam /etc/ssl/certs/dhparam-2048.pem;
        ssl_certificate /etc/letsencrypt/live/${relay.serverName}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${relay.serverName}/privkey.pem;
    `
  if (relay.staticServer) {
    httpsText +=
      ` root /var/www/html/${relay.serverName};
        index index.html index.htm index.nginx-debian.html;

        location / {
            # First attempt to serve request as file, then
            # as directory, then fall back to redirecting to index.html
            try_files $uri $uri/ /index.html;
        }

        # # Media: images, icons, video, audio, HTC
        location ~* \\.(?:jpg|jpeg|gif|png|ico|cur|gz|svg|svgz|mp4|ogg|ogv|webm|htc)$ {
          expires 1M;
          access_log off;
          add_header Cache-Control "public";
        }

        # # Javascript and CSS files
        location ~* \\.(?:css|js)$ {
            try_files $uri =404;
            expires 1y;
            access_log off;
            add_header Cache-Control "public";
        }

        # # Any route containing a file extension (e.g. /devicesfile.js)
        location ~ ^.+\\..+$ {
            try_files $uri =404;
        }
      `
  } else {
    httpsText +=
    `location / {
        proxy_pass http://${relay.relay.replace('localhost', 'host.docker.internal')}/;
        proxy_buffering on;
        proxy_set_header Host            $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }`
  }
  httpsText += ')\n'
  return httpsText
}

async function checkForPortUsage (port: number) : Promise<Boolean> {
  const result = await check(port, 'webserver')
  return result
}

async function certificateCheck () {
  log('Checking for certificates')
  const relays = currentServerConfig.relays
  for (let i = 0; i < relays.length; i += 1) {
    if (relays[i].https && fs.existsSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/temporary`))) {
      log(`${relays[i].serverName} - # Relay has temporary certificate`)
      const httpsInUse = await checkForPortUsage(443)
      const httpInUse = await checkForPortUsage(80)
      if (httpInUse && httpsInUse) {
        log(`${relays[i].serverName} - # Creating full certificate`)
        await certbot.getCertificate(relays[i].serverName)
        fs.unlinkSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/temporary`))
        reloadNginx()
        log(`${relays[i].serverName} - # Full certificate created, reloading NGINX`)
      } else {
        log(`${relays[i].serverName} - # Servers not open for certificate creation`)
      }
    }
  }
}

async function createNginxConfig (serverConfig: ServerConfig) {
  let nginxConf = 'server_names_hash_bucket_size  64;\n'
  const relays = serverConfig.relays
  log('Creating Relays Config')
  for (let i = 0; i < relays.length; i += 1) {
    // Creates Relays Initial Configuration
    nginxConf += addHttpServer(relays[i])

    // Creates HTTPs config if required
    if (relays[i].https) {
      nginxConf += addHttpsServer(relays[i])
      createDir('../build/dhparam/')
      createDir('../build/certificates/')

      // If certificate doesnt exist creates temporary certificate
      if (!fs.existsSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}`))) {
        createDir(`../build/certificates/${relays[i].serverName}`)
        const certificatePath = path.join(`build/certificates/${relays[i].serverName}`)
        log(`${relays[i].serverName} - # Creating Dummy Certificates`)
        await execProcess('openssl', ['req', '-x509', '-nodes', '-days', '365', '-newkey', 'rsa:2048', '-keyout', `${certificatePath}/privkey.pem`, '-out', `${certificatePath}/fullchain.pem`, '-subj', `/C=${serverConfig.address.country}/ST=${serverConfig.address.city}/L=${serverConfig.address.neighborhood}/O=${serverConfig.project}/OU=IT-Department/CN=${relays[i].serverName}`])
        fs.writeFileSync(path.join(__dirname, `../build/certificates/${relays[i].serverName}/temporary`), '')
      }
    }
  }

  // Creates DHParam
  const dhparamPath = path.join(__dirname, '../build/dhparam/dhparam-2048.pem')
  if (!fs.existsSync(dhparamPath)) {
    log('Creating DHParam')
    await execProcess('openssl', ['dhparam', '-out', dhparamPath, '2048'])
  }

  // After creating complete config waits for challenge and reloads NGINX
  log('Finished Relays Config')
  createDir('../build/challenge')
  fs.writeFileSync(pathToConfig, nginxConf)
  reloadNginx()
}

const certbot = new CertbotHelper(currentServerConfig.contactEmail)

fs.watch(path.resolve(path.join(__dirname, '/../relay-config.json')), (event, filename) => {
  log('Relay Config File Changed')
  try {
    const newServerConfig = JSON.parse(fs.readFileSync(pathToRelayConfig, { encoding: 'utf8' })) as ServerConfig
    if (!lodash.isEqual(newServerConfig, currentServerConfig)) {
      log('Updated Server Config Detected')
      currentServerConfig = newServerConfig
      createNginxConfig(newServerConfig)
    }
  } catch (err) {
    log('Error With New Config')
    console.log(err)
  }
})

const checkForCertificates = cron.schedule('0 * * * * *', async () => {
  await certificateCheck()
}, {
  scheduled: false
})

const renewCertificates = cron.schedule('0 0 1 * *', async () => {
  log('Renewing certificates')
  await certbot.renew(currentServerConfig.relays)
  reloadNginx()
}, {
  scheduled: false
})

async function main () {
  // Creates Base Folders
  createDir('../build')
  createDir('../build/conf')
  createDir('../build/websites')

  // Creates Relays Initial Configuration
  createNginxConfig(currentServerConfig)

  // Starts certificates checking
  await certificateCheck()
  checkForCertificates.start()
  renewCertificates.start()
}

main()

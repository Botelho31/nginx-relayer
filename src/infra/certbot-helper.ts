import { exec } from 'child_process'
import util from 'util'
import fs from 'fs'
import path from 'path'
import { RelayConfig } from '../domain/model/relay-config'

const execPromise = util.promisify(exec)

export default class CertbotHelper {
  private readonly contactEmail: String;
  constructor (contactEmail: String) {
    this.contactEmail = contactEmail
  }

  async getCertificate (serverName: String) : Promise<void> {
    const challengePath = path.join(__dirname, '../../build/challenge')
    await execPromise(`certbot certonly --webroot --webroot-path=${challengePath} --email ${this.contactEmail} --agree-tos --noninteractive --no-eff-email -d ${serverName}`)
    const fullchain = fs.readFileSync(`/etc/letsencrypt/live/${serverName}/fullchain.pem`, 'utf8')
    const privkey = fs.readFileSync(`/etc/letsencrypt/live/${serverName}/privkey.pem`, 'utf8')
    fs.writeFileSync(path.join(__dirname, `../../build/certificates/${serverName}/fullchain.pem`), fullchain)
    fs.writeFileSync(path.join(__dirname, `../../build/certificates/${serverName}/privkey.pem`), privkey)
  }

  async renew (relays: RelayConfig[]) : Promise<any> {
    try {
      await execPromise('certbot renew')
      for (let i = 0; i < relays.length; i += 1) {
        if (!relays[i].https) continue
        const serverName = relays[i].serverName
        const fullchain = fs.readFileSync(`/etc/letsencrypt/live/${serverName}/fullchain.pem`, 'utf8')
        const privkey = fs.readFileSync(`/etc/letsencrypt/live/${serverName}/privkey.pem`, 'utf8')
        fs.writeFileSync(path.join(__dirname, `../../build/certificates/${relays[i].serverName}/fullchain.pem`), fullchain)
        fs.writeFileSync(path.join(__dirname, `../../build/certificates/${relays[i].serverName}/privkey.pem`), privkey)
      }
    } catch (err) {
      console.log(err)
    }
  }
}

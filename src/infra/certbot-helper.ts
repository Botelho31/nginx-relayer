import { exec } from 'child_process'
import util from 'util'
import fs from 'fs'
import path from 'path'
import { Certificate } from '../domain/model/certificate'

const execPromise = util.promisify(exec)

export default class CertbotHelper {
  private readonly contactEmail: String;
  constructor (contactEmail: String) {
    this.contactEmail = contactEmail
  }

  async getCertificate (serverName: String) : Promise<Certificate> {
    const challengePath = path.join(__dirname, '../../build/challenge')
    await execPromise(`certbot certonly --webroot --webroot-path=${challengePath} --email ${this.contactEmail} --agree-tos --noninteractive --no-eff-email -d ${serverName}`)
    const fullchain = fs.readFileSync(`/etc/letsencrypt/live/${serverName}/fullchain.pem`, 'utf8')
    const privkey = fs.readFileSync(`/etc/letsencrypt/live/${serverName}/privkey.pem`, 'utf8')
    return {
      fullchain,
      privkey
    }
  }

  async renew () : Promise<any> {
    try {
      await execPromise('certbot renew')
    } catch (err) {
      console.log(err)
    }
  }
}

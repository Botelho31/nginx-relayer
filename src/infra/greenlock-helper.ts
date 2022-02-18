'use strict'

import path from 'path'

const pkg = require('../../package.json')
const Greenlock = require('greenlock')

export default class GreenlockHelper {
  private greenlock;

  constructor (contactEmail: String) {
    const http01 = require('acme-http-01-webroot').create({
      webroot: path.join(__dirname, '../../build/challenge')
    })
    this.greenlock = Greenlock.create({
      packageRoot: __dirname,
      configDir: '../../greenlock.d/',
      packageAgent: pkg.name + '/' + pkg.version,
      maintainerEmail: contactEmail,
      // staging: true,
      challenges: {
        'http-01': http01
      },
      notify: function (event: any, details: any) {
        if (event === 'error') {
          // `details` is an error object in this case
          console.error(details)
        }
      }
    })
  }

  async getCertificate (serverName: String) : Promise<any> {
    await this.greenlock.add({
      subject: serverName,
      altnames: [serverName]
    })
    const result = await this.greenlock.get({ servername: serverName })
    if (!result) {
      // certificate is not on the approved list
      return null
    }
    if (result.pems && result.pems.privkey && result.pems.cert && result.pems.chain) {
      console.info('Success')
    }

    const fullchain = result.pems.cert + '\n' + result.pems.chain + '\n'
    const privkey = result.pems.privkey

    return {
      fullchain,
      privkey
    }
  }
}

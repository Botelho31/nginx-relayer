'use strict'

import path from 'path'

const pkg = require('../../package.json')
const Greenlock = require('greenlock')

export default class GreenlockHelper {
  private greenlock;

  constructor (contactEmail: String) {
    this.greenlock = Greenlock.create({
      packageRoot: __dirname,
      configDir: '../../greenlock.d/',
      packageAgent: pkg.name + '/' + pkg.version,
      maintainerEmail: contactEmail,
      staging: true,
      notify: function (event: any, details: any) {
        if (event === 'error') {
          // `details` is an error object in this case
          console.error(details)
        }
      }
    })

    this.greenlock.manager.defaults({
      // The "Let's Encrypt Subscriber" (often the same as the maintainer)
      // NOT the end customer (except where that is also the maintainer)
      subscriberEmail: contactEmail,
      agreeToTerms: true,
      challenges: {
        module: 'acme-http-01-webroot',
        webroot: path.join(__dirname, '../../build/challenge')
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

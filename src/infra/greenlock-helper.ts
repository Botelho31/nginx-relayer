'use strict';
import { Certificate } from 'crypto';
import path from 'path';
const pkg = require('../../package.json');
const Greenlock = require('greenlock');

export default class GreenlockHelper {
  private greenlock;

  constructor (contactEmail: String) {
    this.greenlock = Greenlock.create({
        packageRoot: __dirname,
        configDir: "../../greenlock.d/",
        packageAgent: pkg.name + '/' + pkg.version,
        maintainerEmail: contactEmail,
        staging: true,
        notify: function(event: any, details: any) {
            if ('error' === event) {
                // `details` is an error object in this case
                console.error(details);
            }
        }
    });
  }

  async getCertificate (serverName: String) : Promise<any> {
    await this.greenlock.add({
        subject: serverName,
        altnames: [serverName]
    })
    const result = await this.greenlock.get({ servername: serverName })
    if (!result) {
        // certificate is not on the approved list
        return null;
    }
    if (result.pems && result.pems.privkey && result.pems.cert && result.pems.chain) {
      console.info('Success');
    }

    var fullchain = result.pems.cert + '\n' + result.pems.chain + '\n';
    var privkey = result.pems.privkey;

    return {
        fullchain,
        privkey
    };
  }
}
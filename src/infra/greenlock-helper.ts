'use strict';

const pkg = require('./package.json');
const Greenlock = require('greenlock');

export default class GreenlockHelper {
  private greenlock;

  constructor (contactEmail: String) {
    this.greenlock = Greenlock.create({
      // used for the ACME client User-Agent string as per RFC 8555 and RFC 7231
      packageAgent: pkg.name + '/' + pkg.version,
  
      // used as the contact for critical bug and security notices
      // should be the same as pkg.author.email
      maintainerEmail: contactEmail,
  
      // used for logging background events and errors
      notify: function(ev, args) {
          if ('error' === ev || 'warning' === ev) {
              console.error(ev, args);
              return;
          }
          console.info(ev, args);
      }
  });
  }

  async getCertificate (serverName: String) {
    const result = await this.greenlock.get({ servername: serverName })
    if (!result) {
        // certificate is not on the approved list
        return null;
    }

    var fullchain = result.pems.cert + '\n' + result.pems.chain + '\n';
    var privkey = result.pems.privkey;

    return {
        fullchain: fullchain,
        privkey: privkey
    };
  }
}
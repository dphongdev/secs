
(function () {

    let rp = require('request-promise'),
        cheerio = require('cheerio'),
        cfg = require('./secs.cfg.js'),
        log = console.log,
        Utils = require('./Utils.js')

    async function login() {
        var params = { username: cfg.username, password: cfg.password },
            msg = Utils.Http.Message(cfg.pKey),
            encryptedParams = msg.encryptParams(params)
        log(encryptedParams)

        let options = {
            method: 'POST',
            url: cfg.loginUrl,
            headers: cfg.headers,
            form: encryptedParams,
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return { $: cheerio.load(body), cookies: res.headers['set-cookie'] }
            },
        }
        let response = await rp(options)
        log(response.$.html())
        log(response.cookies)
    }
    //login()
    let secs = require('./secs')
    secs.login();
})()

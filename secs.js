
let rp = require('request-promise'),
    // request = require('request'),
    // fs = require('fs'),
    cheerio = require('cheerio'),
    cfg = require('./secs.cfg.js'),
    Utils = require('./Utils.js'),
    log = console.log,
    Message = Utils.Http.Message(cfg.pKey),
    //authenticatedCookies = ['borderproxy-token=SHQjd0aZkLkkm1bBkDbR-Jm2d_lPUyU2ECRIRPpDltE=; Path=/; Expires=Wed, 28 Aug 2019 07:30:37 GMT; HttpOnly']
    authenticatedCookies = ''
function createJar(cookies, rp, url) {
    let jar = rp.jar()
    cookies.forEach(e => {
        e.split(';').forEach(cookie => {
            jar.setCookie(rp.cookie(cookie.trim()), url)
        })
    })
    return jar
}
async function login() {
    try {
        let encryptedForm = Message.encryptParams({ username: cfg.username, password: cfg.password })
        log(encryptedForm)
        log(cfg.loginUrl)
        let options = {
            method: 'POST',
            url: cfg.loginUrl,
            headers: cfg.headers,
            form: encryptedForm,
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return { body, headers: res.headers }
            }
        }
        let res = await rp(options)
        log(res.body)
        log(res.headers)
        ///// decrypt path //////
        // let jsonLogin = JSON.parse(res.body)
        // try {
        //     var result = JSON.parse(jsonLogin.Result);
        //     log('result.Data: %s | result.IV: %s', result.Data, result.IV)
        //     var plainText = Message.Decrypt(result.Data, result.IV);
        //     try {
        //         jsonLogin.Result = JSON.parse(plainText);
        //     } catch (e) {
        //         jsonLogin.Result = plainText;
        //     }
        //     log('Result: %s', jsonLogin.Result)
        // } catch (e) {
        //     log(e)
        // }
        return res.headers['set-cookie']
    } catch (error) {
        throw error.message
    }
    
}
async function fetchAdminPage(authenticatedCookies) {
    log(authenticatedCookies)
    let options = {
        method: 'GET',
        url: cfg.adminUrl,
        headers: cfg.headers,
        jar: createJar(authenticatedCookies, rp, cfg.adminUrl),
        resolveWithFullResponse: true,
        transform: (body, res) => {
            return { body: body, headers: res.headers }
        }
    }
    //log(options)
    let res = await rp(options)
    //log(res.body)
}
async function isValidCookies(authenticatedCookies){
    if(authenticatedCookies != '' && authenticatedCookies === null && authenticatedCookies != undefined){
        let options = {
            method: 'GET',
            url: cfg.adminUrl,
            headers: cfg.headers,
            jar: createJar(authenticatedCookies, rp, cfg.adminUrl),
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return { body: body, headers: res.headers }
            }
        }
        let res = await rp(options)
        //log(res.headers)
        let placeholder = cheerio.load(res.body)('#txt_username').attr('placeholder');
        return placeholder === undefined
    }
    return false
}
function decrypt(body) {
    let json = JSON.parse(body)
    try {
        var result = JSON.parse(json.Result);
        //log('result.Data: %s | result.IV: %s', result.Data, result.IV)
        var plainText = Message.Decrypt(result.Data, result.IV);
        try {
            json.Result = JSON.parse(plainText);
        } catch (e) {
            json.Result = plainText;
        }
        //log('Result: %s', json.Result)
    } catch (e) {
        log(e)
    }
    return json.Result;
}
async function fetchDataWhiteLabel(nameWhiteLabel) {
    if (!(await isValidCookies(authenticatedCookies))) authenticatedCookies = await login()
    log(authenticatedCookies)
    let data = {
        CNAMEID: 0,
        group: "0",
        keyword: nameWhiteLabel,
        pageNum: 1,
        pageSize: 20,
        proxyID: 0
    }
    let options = {
        method: 'POST',
        url: cfg.listUrl,
        headers: cfg.headers,
        form: Message.encryptParams(data),
        jar: createJar(authenticatedCookies, rp, cfg.listUrl),
        resolveWithFullResponse: true,
        transform: (body, res) => {
            return { body: body, headers: res.headers }
        }
    }
    let res = await rp(options)
    log(res.body)
    log(decrypt(res.body))
}

// TEST FUNCTIONS
// (async function(){
//     log(await isValidCookies(authenticatedCookies))
// })()

module.exports = {
    login: login,
    fetchDataWhiteLabel: fetchDataWhiteLabel
}

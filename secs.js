
let rp = require('request-promise'),
    // request = require('request'),
    // fs = require('fs'),
    cheerio = require('cheerio'),
    cfg = require('./secs.cfg.js'),
    Utils = require('./Utils.js'),
    log = console.log,
    Message = null,
    authenticatedCookies = '',
    socket = null,
    socketMethod = null;
var newConsole = (function (originalConsole) {
    return {
        log: function (text) {
            originalConsole.log(text);
            // Your code
            if (socket && socketMethod) socket.emit(socketMethod, text)
        },
        info: function (text) {
            originalConsole.info(text);
            // Your code
        },
        warn: function (text) {
            originalConsole.warn(text);
            // Your code
        },
        error: function (text) {
            originalConsole.error(text);
            // Your code
        }
    };
}(console));
log = newConsole.log

function setSocket(socketClient) {
    if(!socket) socket = socketClient
}
function setSocketMethod(methodName) {
   if(!socketMethod) socketMethod = methodName
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function createJar(cookies, rp, url) {
    let jar = rp.jar()
    cookies.forEach((e, i) => {
        if (i == 0)
            e.split(';').forEach(cookie => {
                jar.setCookie(rp.cookie(cookie.trim()), url)
            })
    })
    return jar
}
async function login() {
    log('|==> Login: %s', cfg.loginUrl)
    try {
        Message = Utils.Http.Message(cfg.pKey)
        let encryptedForm = Message.encryptParams({ username: cfg.username, password: cfg.password })
        //log(encryptedForm)
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
        //log(res.body)
        log(res.headers)
        let cookies = res.headers['set-cookie']
        log(await Utils.File.saveTextFile(__dirname + cfg.fileCookies, cookies))
        log(cookies)
        return cookies
    } catch (error) {
        throw error.message
    }

}
async function isAuthenticatedCookies() {
    log('|==> Authenticate cookies')
    // cookies is in memory
    try {
        if (authenticatedCookies === '' || authenticatedCookies === null || authenticatedCookies === undefined) {
            authenticatedCookies = [(await Utils.File.readTextFile(__dirname + cfg.fileCookies))]
            log('Loaded cookies file:')
            log(authenticatedCookies)
        }
        log('|==> Send authentication request: %s', cfg.adminUrl)
        let options = {
            method: 'GET',
            url: cfg.adminUrl,
            headers: cfg.headers,
            // note : use loginUrl will fetch
            jar: createJar(authenticatedCookies, rp, cfg.adminUrl),
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return { body: body, headers: res.headers }
            }
        }
        let res = await rp(options)
        log(res.headers)
        //await Utils.File.saveTextFile('admin' + new Date().getTime() + '.html', res.body)
        let isAuthenticated = cheerio.load(res.body)('#container-admin-account').attr('data-name') === 'admin-account';
        log('|==> Authencitated: %s', isAuthenticated)
        return isAuthenticated
    } catch (error) {
        log(error)
        return false
    }
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
async function fetchWLSites(nameWhiteLabel, skipValidationCookies) {
    if (skipValidationCookies === undefined || skipValidationCookies === false)
        if (!(await isAuthenticatedCookies())) {
            log('|==> Cookie is expried')
            authenticatedCookies = await login()
        }
        else {
            log('|==> Cookie is available. Use AES key')
            Message = Utils.Http.Message()
        }
    else {
        log('|==> Skip Authentication Cookie is available. Use AES key')
        Message = Utils.Http.Message()
    }
    //authenticatedCookies = await login()
    log('|==> fetchWLSites: %s', cfg.listWLSiteUrl)
    //log(authenticatedCookies)
    let data = {
        CNAMEID: 0,
        group: "0",
        keyword: nameWhiteLabel,
        pageNum: 1,
        pageSize: 20,
        proxyID: 0
    }
    await sleep(1000)
    let options = {
        method: 'POST',
        url: cfg.listWLSiteUrl,
        headers: cfg.headers,
        form: Message.encryptParams(data),
        jar: createJar(authenticatedCookies, rp, cfg.listWLSiteUrl),
        transform: (body, res) => {
            return { body: body, headers: res.headers }
        }
    }
    //log(options)
    let res = await rp(options)
        .catch(function (err) {
            log(err.message)
            return []
        })
    //log('body:%s', res.body)
    //log(res.headers)
    let sites = decrypt(res.body).Sites
    log('sites.length = %s', sites.length)
    log(sites)
    return sites
}
/**
* 
* @param {*} nameWhiteLabel 
* @param {*} siteData 
* @param {*} type : fore use "ag", "moblie", "mb"
*/
function getTypeSite(nameWhiteLabel, siteData, type) {
    let sites = siteData
    let siteId = 0,
        siteName = ''
    switch (type) {
        case "ag":
            siteName = type + "." + nameWhiteLabel + '.bpx';
            break
        case "mb":
            siteName = nameWhiteLabel + '.bpx';
            break
        case "mo":
            siteName = "mobile." + nameWhiteLabel + '.bpx';
            break
    }
    for (var site of sites) {
        if (site.Host === siteName) {
            siteId = site.ID;
            break;
        }
    }
    return siteId
}
async function fetchWLDomains(nameWhiteLabel, typeSite, siteData, skipValidationCookies) {

    if (skipValidationCookies === undefined || skipValidationCookies === false)
        if (!(await isAuthenticatedCookies())) {
            log('|==> Cookie is expried')
            authenticatedCookies = await login()
        }
        else {
            log('|==> Cookie is available. Use AES key')
            Message = Utils.Http.Message()
        }
    let data = {
        siteId: getTypeSite(nameWhiteLabel, siteData || await fetchWLSites(nameWhiteLabel, true), typeSite) // ID = 51
    }
    await sleep(1000)
    log('|==> Fetch Domain: %s', cfg.listWLDomainUrl)
    log(nameWhiteLabel)
    log(typeSite)
    let options = {
        method: 'POST',
        url: cfg.listWLDomainUrl,
        headers: cfg.headers,
        form: Message.encryptParams(data),
        jar: createJar(authenticatedCookies, rp, cfg.listWLDomainUrl),
        resolveWithFullResponse: true,
        transform: (body, res) => {
            return { body: body, headers: res.headers }
        }
    }
    let res = await rp(options)
    let domains = decrypt(res.body)
    log('domains.length = %s', domains.length)
    return domains
}
async function fetchWLSiteAddrs(nameWhiteLabel, typeSite, siteData, skipValidationCookies) {
    if (skipValidationCookies === undefined || skipValidationCookies === false)
        if (!(await isAuthenticatedCookies())) {
            log('|==> Cookie is expried')
            authenticatedCookies = await login()
        }
        else {
            log('|==> Cookie is available. Use AES key')
            Message = Utils.Http.Message()
        }

    let data = {
        siteId: getTypeSite(nameWhiteLabel, siteData || await fetchWLSites(nameWhiteLabel, true), typeSite)
    }
    await sleep(1000)
    log('|==> Fetch Site Addrs: %s', cfg.listWLSiteAddrUrl)
    let options = {
        method: 'POST',
        url: cfg.listWLSiteAddrUrl,
        headers: cfg.headers,
        form: Message.encryptParams(data),
        jar: createJar(authenticatedCookies, rp, cfg.listWLSiteAddrUrl),
        resolveWithFullResponse: true,
        transform: (body, res) => {
            return { body: body, headers: res.headers }
        }
    }
    let res = await rp(options)
    let siteAddrs = decrypt(res.body)
    log('siteAddrs.length = %s', siteAddrs.length)
    return siteAddrs
}
module.exports = {
    isAuthenticatedCookies: isAuthenticatedCookies,
    login: login,
    fetchWLSites: fetchWLSites,
    fetchWLDomains: fetchWLDomains,
    fetchWLSiteAddrs: fetchWLSiteAddrs,
    setSocketMethod: setSocketMethod,
    setSocket: setSocket
}

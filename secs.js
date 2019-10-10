
let rp = require('request-promise'),
    // request = require('request'),
    // fs = require('fs'),
    cheerio = require('cheerio'),
    cfg = require('./secs.cfg.js'),
    Utils = require('./Utils.js'),
    log = console.log,
    Message = null,
    authenticatedCookies = ''

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
        log(await Utils.File.saveTextFile(cfg.fileCookies, cookies))
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
            authenticatedCookies = [(await Utils.File.readTextFile(cfg.fileCookies))]
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
    return decrypt(res.body).Sites
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
async function fetchWLDomains(nameWhiteLabel, typeSite, siteData) {
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
    //log(res.body)
    return decrypt(res.body)
}
async function fetchWLSiteAddrs(nameWhiteLabel, typeSite, siteData) {
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
    //log(res.body)
    return decrypt(res.body)
}

// TEST FUNCTIONS
(async function () {
    //log(await login())
    //log(await isAuthenticatedCookies(authenticatedCookies))
    //log(await fetchWLSites(cfg.nameWLTest))
    //log(await fetchWLDomains(cfg.nameWLTest, 'mb', siteData))
    log(await fetchWLSiteAddrs(cfg.nameWLTest, 'mb'))
    //log(await Utils.File.readCookies(cfg.fileCookies));
})()

module.exports = {
    isAuthenticatedCookies: isAuthenticatedCookies,
    login: login,
    fetchWLSites: fetchWLSites,
    fetchWLDomains: fetchWLDomains
}

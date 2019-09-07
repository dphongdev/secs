
let rp = require('request-promise'),
    request = require('request'),
    // fs = require('fs'),
    cheerio = require('cheerio'),
    cfg = require('./secs.cfg.js'),
    Utils = require('./Utils.js'),
    log = console.log,
    Message = '', //Utils.Http.Message(cfg.pKey),
    //authenticatedCookies = ['borderproxy-token=SHQjd0aZkLkkm1bBkDbR-Jm2d_lPUyU2ECRIRPpDltE=; Path=/; Expires=Wed, 28 Aug 2019 07:30:37 GMT; HttpOnly']
    authenticatedCookies = ''


function createJar(cookies, rp, url) {
    let jar = rp.jar()
    cookies.forEach((e,i) => {
        //if(i == 0)
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
        let cookies = res.headers['set-cookie']
        log(await Utils.File.saveTextFile(cfg.fileCookies, cookies))
        log(cookies)
        return cookies
    } catch (error) {
        throw error.message
    }

}
async function fetchAdminPage() {
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
async function isAuthenticatedCookies() {
    log('|==> Authenticate cookies')
    // cookies is in memory
    try {
        if (authenticatedCookies === '' || authenticatedCookies === null || authenticatedCookies === undefined){
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
        await Utils.File.saveTextFile('admin' + new Date().getTime() + '.html', res.body)
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
    // if (skipValidationCookies === undefined || skipValidationCookies === false)
    //     if (!(await isAuthenticatedCookies())){
    //         log('|==> Authenticated cookie is expried')
    //         authenticatedCookies = await login()
    //     }
    
    //authenticatedCookies = await login()
    authenticatedCookies = [(await Utils.File.readTextFile(cfg.fileCookies))]
    Message = Utils.Http.Message()
    log('|==> fetchWLSites: %s', cfg.listWLSiteUrl)
    log(authenticatedCookies)
    var authenticatedJar = createJar(authenticatedCookies, rp, cfg.listWLSiteUrl)
    log(authenticatedJar)
    //Message = Utils.Http.Message()
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
        url: cfg.listWLSiteUrl,
        headers: cfg.headers,
        form: Message.encryptParams(data),
        jar: authenticatedJar
    }
    request(options, async function (error, response, body) {
        console.error('error:', error)
        console.log('statusCode:', response && response.statusCode)
        console.log('body:', body)
        options = {
            method: 'POST',
            url: cfg.listWLSiteUrl,
            headers: cfg.headers,
            form: Message.encryptParams(data),
            jar: createJar(authenticatedCookies, rp, cfg.listWLSiteUrl),
            transform: (body, res) => {
                return { body: body, headers: res.headers }
            }
        }
        let res = await rp(options)
        .catch(function (err) {
            log(err.message)
            return 0
        })
        log(decrypt(res.body))
    });
}
function getWLMembersite(nameWhiteLabel, dataSite) {
    let sites = dataSite.Sites
    let siteId = 0
    for (var site of sites) {
        if (site.Host === nameWhiteLabel + '.bpx') {
            siteId = site.ID;
            break;
        }
    }
    return siteId
}
async function fetchWLDomains(nameWhiteLabel) {
    if (!(await isAuthenticatedCookies()))
        authenticatedCookies = await login()
    //log(authenticatedCookies)
    let data = {
        siteId: getWLMembersite(nameWhiteLabel, await fetchWLSites(nameWhiteLabel, true)) // 51
    }
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
    log(res.body)
    log(decrypt(res.body))
}

// TEST FUNCTIONS
(async function () {
    //log(await login())
    //log(await isAuthenticatedCookies(authenticatedCookies))
    fetchWLSites(cfg.nameWLTest)
    //fetchWLDomains(cfg.nameWLTest)
    //log(await Utils.File.readCookies(cfg.fileCookies));
})()

module.exports = {
    authenticatedCookies: authenticatedCookies,
    login: login,
    fetchWLSites: fetchWLSites
}

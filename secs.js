let rp = require('request-promise'),
    cheerio = require('cheerio'),
    cfg = require('./secs.cfg.js'),
    Utils = require('./Utils.js'),
    Message = null,
    authenticatedCookies = '',
    socket = null,
    socketMethod = null,
    newConsole = (function (originalConsole) {
        return {
            log: function (text) {
                originalConsole.log(text);
                // Your code
                if (socket && socketMethod) {
                    originalConsole.log(socketMethod);
                    //originalConsole.log(socket);
                    socket.emit(socketMethod, text)
                }
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
        }
    }(console)),
    log = newConsole.log;

function setSocket(socketClient) {
    socket = socketClient
}

function setSocketMethod(methodName) {
    socketMethod = methodName
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
    log(`|==> Login: ${cfg.loginUrl}`)
    try {
        Message = Utils.Http.Message(cfg.pKey)
        let encryptedForm = Message.encryptParams({
            username: cfg.username,
            password: cfg.password
        })
        //log(encryptedForm)
        let options = {
            method: 'POST',
            url: cfg.loginUrl,
            headers: cfg.headers,
            form: encryptedForm,
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return {
                    body,
                    headers: res.headers
                }
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
        log(`|==> Send authentication request: ${cfg.adminUrl}`)
        let options = {
            method: 'GET',
            url: cfg.adminUrl,
            headers: cfg.headers,
            // note : use loginUrl will fetch
            jar: createJar(authenticatedCookies, rp, cfg.adminUrl),
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return {
                    body: body,
                    headers: res.headers
                }
            }
        }
        let res = await rp(options)
        log(res.headers)
        //await Utils.File.saveTextFile('admin' + new Date().getTime() + '.html', res.body)
        let isAuthenticated = cheerio.load(res.body)('#container-admin-account').attr('data-name') === 'admin-account';
        log(`|==> Authencitated: ${isAuthenticated}`)
        return isAuthenticated
    } catch (error) {
        log(error)
        return false
    }
}

// common method to skip validation cookies for three fetching functions
async function skipValidationCookies(isSkippedValidationCookies) {
    if (!isSkippedValidationCookies) {
        if (!(await isAuthenticatedCookies())) {
            log('|==> Cookie is expried')
            authenticatedCookies = await login()
        }
        else {
            log('|==> Cookie is available. Use AES key')
            Message = Utils.Http.Message()
            await sleep(1000)
        }
    } else {
        log('|==> Skip Authentication Cookie (Ensure cookies is available). Use AES key')
        Message = Utils.Http.Message()
        await sleep(1000)
    }
}
/**
 * 
 * @param {*} nameWhiteLabel hanaha
 * @param {*} siteData [{ID:123, Host:"hanaha.bpx"},{}....]
 * @param {*} type [mo: mobile , mb : membersite, ag: agent site]
 */
function getSiteId(nameWhiteLabel, siteData, type) {
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

function decrypt(body) {
    let json = JSON.parse(body)
    try {
        var result = JSON.parse(json.Result);
        //log(`result.Data: {%s}`| result.IV: {%s}`, result.Data, result.IV)
        var plainText = Message.Decrypt(result.Data, result.IV);
        try {
            json.Result = JSON.parse(plainText);
        } catch (e) {
            json.Result = plainText;
        }
        //log(`Result: {%s}`, json.Result)
    } catch (e) {
        log(e)
    }
    return json.Result;
}

/**
 * 
 * @param {*} url 
 * @param {*} nameWhiteLabel hanaha -> fetch one, "" -> fetch all
 * @param {*} isSkippedValidationCookies 
 */
async function fetchSites(nameWhiteLabel, isSkippedValidationCookies) {
    await skipValidationCookies(isSkippedValidationCookies)
    let url = cfg.listWLSiteUrl
    log(`|==> fetchSites: ${url}`)
    let data = {
        CNAMEID: 0,
        group: "0",
        keyword: nameWhiteLabel,
        pageNum: 1,
        pageSize: 1000,
        proxyID: 0
    }
    await sleep(1000)
    let options = {
        method: 'POST',
        url: url,
        headers: cfg.headers,
        form: Message.encryptParams(data),
        jar: createJar(authenticatedCookies, rp, url),
        transform: (body, res) => {
            return {
                body: body,
                headers: res.headers
            }
        }
    }
    //log(options)
    let res = await rp(options)
        .catch(function (err) {
            log(err.message)
            return []
        })
    //log(`body:{%s}`, res.body)
    //log(res.headers)
    let sites = decrypt(res.body).Sites
    log(`sites.length = ${sites.length}`)
    //log(JSON.stringify(sites))
    return sites
}

async function fetchDomainsBySiteId(siteId, isSkippedValidationCookies) {
    try {
        await skipValidationCookies(isSkippedValidationCookies)
        let data = {
            siteId: siteId
        }
        let url = cfg.listWLDomainUrl
        log(`|==> Fetch Domains: ${url}`)
        let options = {
            method: 'POST',
            url: url,
            headers: cfg.headers,
            form: Message.encryptParams(data),
            jar: createJar(authenticatedCookies, rp, url),
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return {
                    body: body,
                    headers: res.headers
                }
            }
        }
        let res = await rp(options)
        let domains = decrypt(res.body)
        log(`domains.length = ${domains.length}`)
        //log(domains)
        return domains
    } catch (error) {
        log(error)
        return []
    }
}

async function fetchServerBySiteId(siteId, isSkippedValidationCookies) {
    await skipValidationCookies(isSkippedValidationCookies)
    let data = {
        siteId: siteId
    }
    let url = cfg.listWLServerBySiteUrl
    log(`|==> Fetch Site Addrs: ${url}`)
    let options = {
        method: 'POST',
        url: url,
        headers: cfg.headers,
        form: Message.encryptParams(data),
        jar: createJar(authenticatedCookies, rp, url),
        resolveWithFullResponse: true,
        transform: (body, res) => {
            return {
                body: body,
                headers: res.headers
            }
        }
    }
    let res = await rp(options)
    let servers = decrypt(res.body)
    log(`servers.length = ${servers.length}`)
    return servers
}

async function fetchAllServers(isSkippedValidationCookies) {
    await skipValidationCookies(isSkippedValidationCookies)
    // let data = {
    //     siteId: siteId
    // }
    let url = cfg.listWLServerUrl
    log(`|==> Fetch Site Addrs: ${url}`)
    let options = {
        method: 'POST',
        url: url,
        headers: cfg.headers,
        form: Message.encryptParams(undefined),
        jar: createJar(authenticatedCookies, rp, url),
        resolveWithFullResponse: true,
        transform: (body, res) => {
            return {
                body: body,
                headers: res.headers
            }
        }
    }
    let res = await rp(options)
    let servers = decrypt(res.body)
    log(`servers.length = ${servers.length}`)
    //log(servers)
    return servers
}

async function fetchAllWhiteLabelsName(isSkippedValidationCookies) {
    await skipValidationCookies(isSkippedValidationCookies)
    let url = cfg.listWhiteLabelsName
    log(`|==> Fetch WL Names: ${url}`)
    let options = {
        method: 'POST',
        dataType: "json",
        url: url,
        headers: cfg.headers,
        form: Message.encryptParams(undefined),
        jar: createJar(authenticatedCookies, rp, url),
        resolveWithFullResponse: true,
        transform: (body, res) => {
            return {
                body: body,
                headers: res.headers
            }
        }
    }
    //log(options)
    let res = await rp(options)
    //log(res.headers)
    //log(res.body)
    let listWhiteLabelsName = decrypt(res.body)
    log(`listWhiteLabelsName.length = ${listWhiteLabelsName.length}`)
    log(listWhiteLabelsName)
    return listWhiteLabelsName
}
module.exports = {
    fetchSites: fetchSites,
    fetchDomainsBySiteId: fetchDomainsBySiteId,
    fetchServerBySiteId: fetchServerBySiteId,
    fetchAllServers:fetchAllServers,
    fetchAllWhiteLabelsName: fetchAllWhiteLabelsName,
    setSocketMethod: setSocketMethod,
    setSocket: setSocket,
    getSiteId: getSiteId
}

let rp = require('request-promise'),
    // request = require('request'),
    // fs = require('fs'),
    //cheerio = require('cheerio'),
    cfg = require('./secs.cfg.js'),
    Utils = require('./Utils.js'),
    log = console.log,
    Message = Utils.Http.Message(cfg.pKey),
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
        let jsonLogin = JSON.parse(res.body)
        try {
            var result = JSON.parse(jsonLogin.Result);
            log('result.Data: %s | result.IV: %s', result.Data, result.IV)
            var plainText = Message.Decrypt(result.Data, result.IV);
            try {
                jsonLogin.Result = JSON.parse(plainText);
            } catch (e) {
                jsonLogin.Result = plainText;
            }
            log('Result: %s', jsonLogin.Result)
        } catch (e) {
            log(e)
        }
        //log(response.headers)
        authenticatedCookies = res.headers['set-cookie']
        fetchAdminPage(authenticatedCookies)
    } catch (error) {
        log(error.message)
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
async function fetchDataWhiteLabel(nameWhiteLabel) {
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


module.exports = {
    login: login
}

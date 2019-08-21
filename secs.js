
let rp = require('request-promise'),
    // request = require('request'),
    // fs = require('fs'),
    cheerio = require('cheerio'),
    cfg = require('./secs.cfg.js'),
    log = console.log,
    Utils = require('./Utils.js')

async function fetchHomePage() {
    log(cfg.homeUrl)
    try {
        var options = {
            method: 'GET',
            url: cfg.homeUrl,
            headers: cfg.headers,
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return { cookies: res.headers['set-cookie'], body: body }
            },
        }
        return await rp(options)
    } catch (error) {
        log(error.message)
    }
}
function createJar(cookies, rp, url) {
    let jar = rp.jar()
    cookies.forEach(e => {
        e.split(';').forEach((cookie, index) => {
            if(index == 0)
                jar.setCookie(rp.cookie(cookie.trim()), url)
        })
    })
}
async function login() {
    try {
        let homePage = await fetchHomePage();
        //log(homePage.body);
        log(homePage.cookies);
        let params = { username: cfg.username, password: cfg.password };
        log(params)
        log(cfg.pKey)
        let Message = Utils.Http.Message(cfg.pKey)
        let encryptedForm = Message.encryptParams(params)
        log(encryptedForm)
        log(cfg.loginUrl)
        var jar = createJar(homePage.cookies, rp, cfg.homeUrl)
        let options = {
            method: 'POST',
            url: cfg.loginUrl,
            headers: cfg.headers,
            jar: jar,
            form: encryptedForm,
            resolveWithFullResponse: true,
            transform: (body, res) => {
                return { body, headers: res.headers }
            }
        }
        let res = await rp(options)
        log(res.body)
        log(res.headers)
        let jsonResultBodyLogin = JSON.parse(res.body)
        try {
            var result = JSON.parse(jsonResultBodyLogin.Result);
            //result.Data = '%2BJ%2B6s77FZa9TbgZo7PXqaA%3D%3D';
            log('result.Data:%s | result.IV:%s',result.Data, result.IV)
            var plainText = Message.Decrypt(result.Data, result.IV);
            //log('plainText:%s',plainText)
            try {
                jsonResultBodyLogin.Result = JSON.parse(plainText);
            } catch (e) {
                jsonResultBodyLogin.Result = plainText;
            }
            log('Result:%s',jsonResultBodyLogin.Result)
        } catch (e) {
            log(e)
        }
        //log(response.headers)
        fetchAdminPage(res.headers['set-cookie'])
    } catch (error) {
        log(error.message)
    }
}
async function fetchAdminPage(cookies) {
    // let response = await rp(options)
    // log(response)
    const request = require('request');
    var jarAdmin = request.jar()
    cookies.forEach(e => {
        e.split(';').forEach((cookie, index) => {
            //if(index === 0)
            jarAdmin.setCookie(request.cookie(cookie.trim()), cfg.adminUrl)
        })
    })
    let options = {
        method: 'GET',
        url: cfg.adminUrl,
        headers: cfg.headers,
        jar: jarAdmin,
    }
    log(options)
    request(options, function (error, response, body) {
        console.error('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log('body:', body); // Print the HTML for the Google homepage.
    });
}

module.exports = {
    login: login
}

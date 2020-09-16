(async function () {
    const scraper = require('../secs'),
        log = console.log
    //log(await scraper.login())
    await scraper.isAuthenticatedCookies()
})()
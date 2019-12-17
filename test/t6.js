(async function () {
    const scraper = require('../secs'),
        log = console.log
    log(await scraper.fetchBackendId(35, false))
})()

(async function () {
    const scraper = require('../secs'),
        log = console.log,
        siteData = await scraper.fetchSites("")
    log(siteData)
})()
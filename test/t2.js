
(async function () {
    const scraper = require('../secs'),
        log = console.log,
    var siteData = await scraper.fetchSites("")
    log(siteData)
})()
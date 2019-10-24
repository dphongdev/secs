
(async function () {
    const scraper = require('../secs'),
        log = console.log,
        cfg = require('../secs.cfg.js')
    var siteData = await scraper.fetchSites(cfg.nameWLTest)
    log(siteData)
})()
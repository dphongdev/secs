(async function () {
    const scraper = require('../secs'),
        log = console.log,
        cfg = require('../secs.cfg.js')
    var siteData = await scraper.fetchSites(cfg.nameWLTest)
    var siteId = scraper.getSiteId(cfg.nameWLTest, siteData, 'mb')
    log( await scraper.fetchDomainsBySiteId(siteId))
})()
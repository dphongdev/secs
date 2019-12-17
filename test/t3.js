(async function () {
    const scraper = require('../secs'),
        log = console.log,
        cfg = require('../secs.cfg.js'),
        siteData = await scraper.fetchSites(cfg.nameWLTest),
        siteId = scraper.getSiteId(cfg.nameWLTest, siteData, 'mb')
    log(await scraper.fetchServerBySiteId(siteId))
})()
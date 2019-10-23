
// TEST FUNCTIONS
(async function () {
    const scraper = require('../secs'),
        log = console.log,
        cfg = require('../secs.cfg.js')

    // /////////////// star test case for fetchServerBySiteId //////////////////
    var siteData = await scraper.fetchSites(cfg.nameWLTest)
    var siteId = scraper.getSiteId(cfg.nameWLTest, siteData, 'mb')
    scraper.fetchDomainsBySiteId(siteId)
    // ////////////// end test case for fetchServerBySiteId //////////////////
})()
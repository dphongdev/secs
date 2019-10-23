
// TEST FUNCTIONS
(async function () {
    const scraper = require('../secs'),
        log = console.log,
        cfg = require('../secs.cfg.js')
    /////////////// star test case for fetchSites one white label //////////////////
    var siteData = await scraper.fetchSites(cfg.nameWLTest)
    log(siteData)
    /////////////// end test case for fetchServerBySiteId ///////////////////////////
})()
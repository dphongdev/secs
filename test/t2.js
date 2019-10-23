
// TEST FUNCTIONS
(async function () {
    const scraper = require('../secs'),
        log = console.log,
        cfg = require('../secs.cfg.js')
    /////////////// star test case for fetchSites all white labels //////////////////
    var siteData = await scraper.fetchSites("")
    log(siteData)
    /////////////// end test case for fetchServerBySiteId ///////////////////////////
})()
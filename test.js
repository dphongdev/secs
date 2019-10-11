
// TEST FUNCTIONS

(async function () {
    const scraper = require('./secs'), 
    log = console.log,
    cfg = require('./secs.cfg.js')
    //log(await login())
    //log(await scraper.isAuthenticatedCookies())
    //log(await fetchWLSites(cfg.nameWLTest))
    //log(await scraper.fetchWLDomains(cfg.nameWLTest, 'mb'))
    log(await scraper.fetchWLSiteAddrs(cfg.nameWLTest, 'mb'))
    //log(await Utils.File.readCookies(cfg.fileCookies));
    log(__dirname)
})()
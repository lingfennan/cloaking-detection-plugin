/**
 * Created by ruian on 7/27/15.
 */

// Constant values.
var Contants = {
    googleSearchBotUA: "Googlebot/2.1 (+http://www.google.com/bot.html)",
    googleAdBotUA: "AdsBot-Google (+http://www.google.com/adsbot.html)"
};

// The black list and white list
function CheckingSet(filename) {
    this.set = {};
    this.ready = false;

    var parent = this;

    function newSetFromFile(filename) {
        var xhr = new XMLHttpRequest();
        // synchronously load these files.
        xhr.open('GET', chrome.extension.getURL(filename), true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
                for (var p in JSON.parse(xhr.responseText)) {
                    parent.set[p] = true;
                }
                parent.ready = true;
            }
        };
        xhr.send();
    }

    newSetFromFile(filename);
}

CheckingSet.prototype.extractDomain = function (url) {
    var domain;
    // find & remove protocol (http, ftp, etc.) and get hostname
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    }
    else {
        domain = url.split('/')[0];
    }
    // find & remove port number
    domain = domain.split(':')[0];
    // get the 2LD or 3LD hostname
    // www.google.com -> google.com
    if (domain.split('.').length > 2) {
        domain = domain.split('.').slice(1).join('.');
    }
    return domain;
}

CheckingSet.prototype.contains = function (url) {
    var domain = this.extractDomain(url);
    if (url in this.set || domain in this.set) {
        return true;
    }
    return false;
};

CheckingSet.prototype.isReady = function () {
    return this.ready;
};

function CookieSet() {
    // When the size of cookie is too large, should we consider localStorage?
    var domainCookieCount = {};
    var ready = false;

    this.update = function (domain, count) {
        var c = count || 1;
        domainCookieCount[domain] = c;
    }

    this.contains = function (domain) {
        if (domain in domainCookieCount) {
            return true;
        }
        return false;
    }

    this.getCookieCount = function (domain) {
        if (domain in domainCookieCount) {
            return domainCookieCount[domain];
        }
        return 0;
    }

    this.isReady = function () {
        return ready;
    }

    this.hasCookieForDomain = function (domainStr, callback) {
        chrome.cookies.getAll({domain: domainStr}, function (cookies) {
            callback(cookies.length);
        });
    }

    // Initialize domainCookieCount.
    function newSetFromCookies() {
        chrome.cookies.getAll({}, function (cookies) {
            for (var cookie in cookies) {
                var key = null;
                if (cookie.hasOwnProperty("hostname")) {
                    key = cookie.hostname;
                } else {
                    key = cookie.url;
                }
                if (key in domainCookieCount) {
                    domainCookieCount[key] += 1;
                } else {
                    domainCookieCount[key] = 1;
                }
            }
            ready = true;
        });
    }

    newSetFromCookies();
}

/* Skip history set for now. This may not be necessary. */
function HistorySet() {
    this.set = {};
    this.ready = false;
}

function HostCache() {
    var cache = {};

    this.setVisibleHostCache = function (host, tabId) {
        cache[tabId] = host;
    };

    this.setVisibleHostCacheFromUrl = function (url, tabId) {
        this.setVisibleHostCache(HelperFunctions.parseHostFromUrl(url), tabId);
    };

    this.fetchVisibleHostCache = function (tabId) {
        if (cache.hasOwnProperty(tabId)) {
            var host = cache[tabId];
            delete cache[tabId];
            return host;
        } else {
            return null;
        }
    };

    this.matchesHost = function (tabId, host) {
        var cacheHost = this.fetchVisibleHostCache(tabId);
        return {result: cacheHost && cacheHost == host, visibleHost: cacheHost, landingHost: host};
    };
}
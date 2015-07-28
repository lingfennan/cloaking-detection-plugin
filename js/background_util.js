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
    // find & remove protocol (http, ftp, etc.) and get domain
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    }
    else {
        domain = url.split('/')[0];
    }
    // find & remove port number
    domain = domain.split(':')[0];
    // get the 2LD or 3LD domain
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

    this.hasCookieForDomain = function (domain, callback) {
        chrome.cookies.getAll({domain: domain}, function (cookies) {
            callback(cookies.length);
        });
    }

    // Initialize domainCookieCount.
    function newSetFromCookies() {
        chrome.cookies.getAll({}, function (cookies) {
            for (var cookie in cookies) {
                var key = null;
                if (cookie.hasOwnProperty("domain")) {
                    key = cookie.domain;
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

// An verdict for program to pass and check.
function Verdict(url, pageHash, domain) {
    this.url = url;
    this.pageHash = pageHash || null;
    this.domain = domain || null;
    this.spiderPageHash = [];
    // distance is optional, we need this only if we are going to call checkCloaking
    // this.distance = 0;
    this.result = null;
}

Verdict.prototype.setResult = function (result) {
    this.result = result;
}
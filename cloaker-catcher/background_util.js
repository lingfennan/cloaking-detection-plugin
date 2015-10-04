/**
 * Created by ruian on 7/27/15.
 */

// Constant values.
var Contants = {
    googleSearchBotUA: "Googlebot/2.1 (+http://www.google.com/bot.html)",
    googleAdBotUA: "AdsBot-Google (+http://www.google.com/adsbot.html)",
    // We found that only one copy is useful. Because the page rarely changes in a short period.
    fetchKSpiderCopies: 1,
    // Mode used in cloaking_checker.
    modeOnline: "online",
    modeOffline: "offline",
    modeUnguarded: "unguarded",
    // Remote server URL for online mode
    // serverAddress: "http://moon.gtisc.gatech.edu:8000",
    serverAddress: "http://ruian.gtisc.gatech.edu:8000/cloaking_detection/patterns/",
    serverResponseResult: "result",
    serverResponseModel: "model"
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

function BGCache() {
    var cache = {};

    this.setValue = function (value, tabId) {
        cache[tabId] = value;
    };

    this.setDomainValueFromUrl = function (url, tabId) {
        this.setValue(HelperFunctions.parseHostFromUrl(url), tabId);
    };

    this.popValue = function (tabId) {
        if (cache.hasOwnProperty(tabId)) {
            var value = cache[tabId];
            delete cache[tabId];
            return value;
        } else {
            return null;
        }
    };

    this.hitAndMismatch = function (tabId, host) {
        /* Check whether cached host of current tab, matched the seen one.
         *
         * Args:
         *  tabId: the id of tab
         *  host: hostname of url
         *
         * Returns:
         *  {result: boolean, value: host}, true if cache is hit and there is mismatch.
         */
        var value = this.popValue(tabId);
        return {result: value && value != host, value: value};
    };
}

function BGVerdictMsg(url, hostname, pageHash, cacheUrl, kSpiderCopies) {
    Verdict.call(this, url, hostname, pageHash);
    this.cacheUrl = cacheUrl || null;
    this.kSpiderCopies = kSpiderCopies || Contants.fetchKSpiderCopies;
    this.spiderPageHash = [];
    // textModels is optional, we set this only if we are receive textModels from server.
    this.textModels = [];
    // domModels is similar to textModels.
    this.domModels = [];
    this.reason = "";
    this.result = null;
}

BGVerdictMsg.prototype.addSpiderPageHash = function(pageHash) {
    this.spiderPageHash.push(pageHash);
};

BGVerdictMsg.prototype.fetchComplete = function() {
    if (this.spiderPageHash.length < this.kSpiderCopies) {
        return false;
    } else {
        return true;
    }
};

BGVerdictMsg.prototype.fetchAlmostComplete = function () {
    if (this.spiderPageHash.length == this.kSpiderCopies - 1) {
        return true;
    } else {
        return false;
    }
};

BGVerdictMsg.prototype.addTextModel = function (model) {
    this.textModels.push(model);
};

BGVerdictMsg.prototype.setTextModels = function (models) {
    this.textModels = models;
};

BGVerdictMsg.prototype.addDomModel = function (model) {
    this.domModels.push(model);
};

BGVerdictMsg.prototype.setDomModels = function (models) {
    this.domModels = models;
};

// Message used by background script to transfer informatino to client.
BGVerdictMsg.prototype.setResult = function (result, reason) {
    this.result = result;
    this.reason = reason || "";
};

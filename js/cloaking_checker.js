/**
 * Created by ruian on 7/18/15.
 */

// The black list and white list
function CheckingSet(filename) {
    this.set = {};
    this.ready = false;

    var parent = this;

    function newSetFromFile(filename) {
        var xhr = new XMLHttpRequest();
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
    return this.set[url] || this.set[domain] || false;
};

CheckingSet.prototype.isReady = function () {
    return this.ready;
};


// An verdict for program to pass and check.
function Verdict(url, simhash) {
    this.hasresult = false;
    this.url = url;
    this.simhash = simhash;
    // this.spidersimhash = [];
    // distance is optional, we need this only if we are going to call checkCloaking
    // this.distance = 0;
    this.result = null;
}

Verdict.prototype.setResult = function (result) {
    this.result = result;
    this.hasresult = true;
}

Verdict.prototype.resultReady = function () {
    return this.hasresult;
};

// The main function to check cloaking and communicate with content scripts.
function CloakingChecker() {
    this.whitelist = new CheckingSet("res/whitelist.json");
    this.blacklist = new CheckingSet("res/blacklist.json");
}

CloakingChecker.prototype.checkCloaking = function (url, simhash, verdict) {
    /*
     * Compare what user sees with with spider copy, return whether it is cloaking or not
     * 1. make a request with spider user agent
     * 2. compute text and dom simahsh
     * 3. compare simhash with spider simhash, if distance is too large then return cloaking
     *
     * Args:
     *  url: the url to check
     *  simhash: the summary of what user sees
     *  verdict: the result object, modify it
     */
    verdict.spidersimhash = [];
    console.log("I am going to do something here");
    verdict.setResult(false);
}

CloakingChecker.prototype.cloakingVerdict = function (url, simhash) {
    if (simhash != null) {
        var v = new Verdict(url, simhash);
        this.checkCloaking(url, simhash, v);
    } else {
        var v = new Verdict(url, simhash);
        console.log("list status, we should guarantee list is ready at this point");
        console.log(this.whitelist.isReady());
        console.log(this.blacklist.isReady());
        if (this.whitelist.contains(url)) {
            v.setResult(false);
        } else if (this.blacklist.contains(url)) {
            v.setResult(true);
        } else {
            // else do nothing and return
            v.setResult(null);
        }
    }
    return v;
};

var checker = new CloakingChecker();

// Send response back to the content script
function handeVerdict(verdict, sendResponse) {
    if (verdict.resultReady()) {
        sendResponse({url: verdict.url, simhash: verdict.simhash, result: verdict.result});
    } else {
        setTimeout(handeVerdict(verdict, sendResponse), 5000);
    }
}

// Listen for message from each tab
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log("request is ", request);
        var verdict = checker.cloakingVerdict(request.url, request.simhash);
        handeVerdict(verdict, sendResponse);
    }
);

console.log("The cloaking checker is running");
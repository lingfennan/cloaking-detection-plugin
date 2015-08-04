/**
 * Created by ruian on 7/18/15.
 */

// The main function to check cloaking and communicate with content scripts.
function CloakingChecker() {
    this.whitelist = new CheckingSet("res/whitelist.json");
    this.blacklist = new CheckingSet("res/blacklist.json");
    this.cookieSet = new CookieSet();
    this.visibleHostCache = new BGCache();
    this.cacheUrlCache = new BGCache();
    // parameters from the paper
    this.textRadius = 15;
    this.domRadius = 13;
    this.textSigmaThreshold = 2.1;
    this.domSigmaThreshold = 1.8;
}

CloakingChecker.prototype.cacheUrlCheckCloakingOffline = function (verdict) {
    /*
     * Compare what user sees with with spider copy, return whether it is cloaking or not
     * 1. make a request with spider user agent
     * 2. compute text and dom simahsh
     * 3. compare user viewed simhash with spider simhash, if distance is too large then return cloaking
     *
     * Args:
     *  verdict: read the url and simhash property, and set the result.
     *      url: the url to check
     *      hostname: the hostname corresponding to url
     *      pageHash: the summary of what user sees
     */
    console.log("I am doing a background request to cached url and computing the decision here.");

    /* Fetches url with crawler user agent in the background.
     */
    var parent = this;
    var xhr = new XMLHttpRequest();
    /* TODO: Do we also need to run on POST?
     * What does search and ads queries use, POST or GET
     */
    xhr.open('GET', verdict.cacheUrl, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            if (xhr.status == 200) {
                // 1. compute simhash of the requested page
                // 2. compute the distance between spider copy and user copy and make a final decision.
                // http://stackoverflow.com/questions/3103962/converting-html-string-into-dom-elements
                // html -> dom object
                console.log("Fetching spider copy");
                if (HelperFunctions.isErrorPage(xhr.responseText)) {
                    this.visibleUrlCheckCloakingOffline(verdict);
                    return;
                }

                // Get the page content, compute and compare.
                var validResponseText = xhr.responseText.split(/<div style="position:relative;">/);
                if (validResponseText.length > 1) {
                    delete validResponseText[0];
                }
                validResponseText = validResponseText.join();
                var hasCookie = this.cookieSet.contains(verdict.hostname);
                var hasLogin = HelperFunctions.hasLogin(validResponseText);
                if (hasCookie && hasLogin) {
                    /* If current page is login page and user has visited it before, then probably user vs. spider will be
                     * different, e.g. Facebook.
                     */
                    var reason = "Since this page has cookie and spider copy has login words, we skip it. This may" +
                        " introduce false negative.";
                    console.log(reason);
                    verdict.setResult(false, reason);
                } else {
                    /* If it is not login page, then compute simhash and return verdict.
                     */
                    this.handleResponseText(validResponseText, verdict);
                    this.handleFetchComplete(verdict);
                }
                // when everything is done, we want to update the cookie table.
                if (!hasCookie) {
                    parent.cookieSet.hasCookieForDomain(verdict.hostname, function (cookieCount) {
                        if (cookieCount > 0) {
                            parent.cookieSet.update(verdict.hostname, cookieCount);
                        }
                    });
                }
            } else {
                // Fallback check of cacheUrlCheckCloaking
                this.visibleUrlCheckCloakingOffline(verdict);
                return;
            }
        }
    }.bind(this);
    xhr.send();
};

CloakingChecker.prototype.handleResponseText = function (reponseText, verdict) {
    // Called when content fetch is ready.
    var doc = new DOMParser().parseFromString(reponseText, "text/html");
    var sc = new SimhashComputer();
    var ph = new PageHash(sc.getTextSimhash(doc.body.innerText),
        sc.getDomSimhash(doc.documentElement));
    verdict.spiderPageHash.push(ph);
};

CloakingChecker.prototype.handleFetchComplete = function (verdict) {
    var textDist = verdict.pageHash.text.hammingDistance(verdict.spiderPageHash[0].text);
    var domDist = verdict.pageHash.dom.hammingDistance(verdict.spiderPageHash[0].dom);

    if (textDist > this.textRadius && domDist > this.domRadius) {
        var reason = "User copy and browser copy are significantly different.";
        verdict.setResult(true, reason);
    } else {
        var reason = "User copy and browser copy are similar.";
        verdict.setResult(false, reason);
    }
    console.log(verdict);
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {message: JSON.stringify(verdict)}, null);
    });
};

CloakingChecker.prototype.visibleUrlCheckCloakingOffline = function (verdict) {
    // Similar to checkCloaking, but fetches k spider copies
    console.log("I am doing a background request and computing the decision here.");
    /* Optional google search cache result fetch.
     */

    /* Fetches url with crawler user agent in the background.
     */
    var parent = this;
    var xhrArray = [];
    xhrArray[0] = new XMLHttpRequest();
    /* TODO: Do we also need to run on POST?
     * What does search and ads queries use, POST or GET
     */
    xhrArray[0].open('GET', verdict.url, true);
    xhrArray[0].spiderId = 0;
    xhrArray[0].onreadystatechange = function () {
        if (this.readyState == XMLHttpRequest.DONE) {
            if (this.status == 200) {
                // 1. compute simhash of the requested page
                // 2. compute the distance between spider copy and user copy and make a final decision.
                // http://stackoverflow.com/questions/3103962/converting-html-string-into-dom-elements
                // html -> dom object
                // http://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro
                // replace html
                console.log("Fetching spider copy " + this.spiderId);
                var hasCookie = parent.cookieSet.contains(verdict.hostname);
                var hasLogin = HelperFunctions.hasLogin(this.responseText);

                if (hasCookie && hasLogin) {
                    /* If current page is login page and user has visited it before, then probably user vs. spider will be
                     * different, e.g. Facebook.
                     */
                    var reason = "Since this page has cookie and spider copy has login words, we skip it. This may" +
                        " introduce false negative.";
                    console.log(reason);
                    verdict.setResult(false, reason);
                    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                        chrome.tabs.sendMessage(tabs[0].id, {message: JSON.stringify(verdict)}, null);
                    });
                } else {
                    /* If it is not login page, then compute simhash and return verdict.
                     * The program already fetched one copy.
                     */
                    if (verdict.fetchAlmostComplete()) {
                        parent.handleResponseText(this.responseText, verdict);
                        if (verdict.fetchComplete()) {
                            parent.handleFetchComplete(verdict);
                        }
                    } else {
                        /*
                         * Fetch the rest k - 1 copies.
                         * TODO: Since we are setting k = 1 now, should we remove the k > 1 code.
                         */
                        for (var i = 1; i < verdict.kSpiderCopies; i++) {
                            xhrArray[i] = new XMLHttpRequest();
                            /* TODO: Do we also need to run on POST?
                             * What does search and ads queries use, POST or GET
                             */
                            xhrArray[i].open('GET', verdict.url, true);
                            xhrArray[i].spiderId = i;
                            console.log("Setting stuff for spider copy " + xhrArray[i].spiderId);
                            xhrArray[i].onreadystatechange = function () {
                                if (this.readyState == XMLHttpRequest.DONE && this.status == 200) {
                                    console.log("Fetching spider copy " + this.spiderId);
                                    // 1. compute simhash of the requested page
                                    // 2. compute the distance between spider copy and user copy and make a final decision.
                                    parent.handleResponseText(this.responseText, verdict);
                                    console.log("have processed N spiders " + verdict.spiderPageHash.length);
                                    console.log(verdict);
                                    if (verdict.fetchComplete()) {
                                        parent.handleFetchComplete(verdict);
                                    }
                                }
                            }.bind(xhrArray[i]);
                            xhrArray[i].send();
                        }  // end for
                        // This is put after the for loop, because we don't want the computation to block other requests.
                        parent.handleResponseText(this.responseText, verdict);
                        if (verdict.fetchComplete()) {
                            parent.handleFetchComplete(verdict);
                        }
                    }  // end if
                }
                // when cookie check is done, we want to update the cookie table.
                if (!hasCookie) {
                    parent.cookieSet.hasCookieForDomain(verdict.hostname, function (cookieCount) {
                        if (cookieCount > 0) {
                            parent.cookieSet.update(verdict.hostname, cookieCount);
                        }
                    });
                }
            }
            else {
                var reason = "Status code is different. Spider get status: " + this.status;
                verdict.setResult(true, reason);
                chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {message: JSON.stringify(verdict)}, null);
                });
            }
        }
    }.bind(xhrArray[0]);
    xhrArray[0].send();
};

CloakingChecker.prototype.cloakingVerdict = function (request, tabId, sendResponse) {
    var url = request.url;
    var host = request.hostname;
    var pageHash = request.pageHash;
    if (pageHash != null) {
        // PageHash contains function that we want to use, initialize it.
        pageHash = new PageHash(new SimhashItem(pageHash.text.value), new SimhashItem(pageHash.dom.value));
        // If google search provides link to their cache, we fetch that copy.
        var cacheUrl = this.cacheUrlCache.popValue(tabId);
        if (cacheUrl && cacheUrl.indexOf(HelperFunctions.removeSchemeFromUrl(url)) != -1) {
            var v = new BGVerdictMsg(url, host, pageHash, cacheUrl);
            // Use cached url to fetch spider copy.
            this.cacheUrlCheckCloakingOffline(v);
        } else {
            var v = new BGVerdictMsg(url, host, pageHash);
            // If we are requesting with pageHash set, the response is going to be sent back using message.
            this.visibleUrlCheckCloakingOffline(v);
        }
    } else {
        var v = new BGVerdictMsg(url, host);
        var hostResult = this.visibleHostCache.hitAndMismatch(tabId, host);
        if (hostResult.result) {
            // If cache is hit and host mismatch.
            var reason = "Visible hostname and landing hostname are different, this is redirect cloaking. Visible" +
                " host is: " + hostResult.value + ", landing hostname is: " + host;
            v.setResult(true, reason);
        } else if (this.whitelist.contains(url)) {
            var reason = "In whitelist.";
            v.setResult(false, reason);
        } else if (this.blacklist.contains(url)) {
            var reason = "In blacklist.";
            v.setResult(true, reason);
        } else {
            // else do nothing and return
            v.setResult(null, null);
        }
        // Send response back to the content script
        sendResponse(v);
    }
};


// Prepare the extension for handling websites.
CloakingChecker.prototype.setRequestUserAgent = function (userAgent) {
    /*
     * Add filter to the xmlhttprequest.
     * http://stackoverflow.com/questions/21090733/changing-user-agent-in-xmlhttprequest-from-a-chrome-extension
     * http://stackoverflow.com/questions/10334909/associate-a-custom-user-agent-to-a-specific-google-chrome-page-tab/10339902#10339902
     */
    console.log("Adding listener");
    chrome.webRequest.onBeforeSendHeaders.addListener(
        function (info) {
            // Replace the User-Agent header
            console.log("Changing headers before request!")
            var headers = info.requestHeaders;
            headers.forEach(function (header, i) {
                if (header.name.toLowerCase() == 'user-agent') {
                    header.value = userAgent;
                }
            });
            return {requestHeaders: headers};
        },
        // Request filter
        {
            // Modify the headers for these pages
            urls: [
                "http://*/*",
                "https://*/*",
            ],
            // In the main window and frames
            types: ["xmlhttprequest"]
        },
        ["blocking", "requestHeaders"]
    );
};

var checker = new CloakingChecker();
checker.setRequestUserAgent(Contants.googleSearchBotUA);

// Listen for message from each tab
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        request = JSON.parse(request.message);
        console.log("request is ", request);
        if (request.from == MessageContants.FromSearchPage) {
            console.log("clicked a link to visible url ", request.url);
            checker.visibleHostCache.setDomainValueFromUrl(request.url, sender.tab.id);
            checker.cacheUrlCache.setValue(request.cacheUrl, sender.tab.id);
        } else if (request.from == MessageContants.FromLandingPage) {
            checker.cloakingVerdict(request, sender.tab.id, sendResponse);
        }
    }
);

console.log("The cloaking checker is running");
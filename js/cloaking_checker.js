/**
 * Created by ruian on 7/18/15.
 */

// The main function to check cloaking and communicate with content scripts.
function CloakingChecker() {
    this.whitelist = new CheckingSet("res/whitelist.json");
    this.blacklist = new CheckingSet("res/blacklist.json");
    this.cookieSet = new CookieSet();
    this.visibleHostCache = new HostCache();
    this.textThreshold = 4;
    this.domThreshold = 5;
}

CloakingChecker.prototype.checkCloaking = function (verdict) {
    /*
     * Compare what user sees with with spider copy, return whether it is cloaking or not
     * 1. make a request with spider user agent
     * 2. compute text and dom simahsh
     * 3. compare simhash with spider simhash, if distance is too large then return cloaking
     *
     * Args:
     *  verdict: read the url and simhash property, and set the result.
     *      url: the url to check
     *      hostname: the hostname corresponding to url
     *      pageHash: the summary of what user sees
     */
    console.log("I am doing a background request and computing the decision here.");

    /* Fetches url with crawler user agent in the background.
     */
    var parent = this;
    var xhr = new XMLHttpRequest();
    /* TODO: Do we also need to run on POST?
     * What does search and ads queries use, POST or GET
     */
    xhr.open('GET', verdict.url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
            // 1. compute simhash of the requested page
            // 2. compute the distance between spider copy and user copy and make a final decision.
            // http://stackoverflow.com/questions/3103962/converting-html-string-into-dom-elements
            // html -> dom object
            // http://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro
            // replace html
            console.log("Fetching spider copy");
            var hasCookie = this.cookieSet.contains(verdict.hostname);
            var hasLogin = HelperFunctions.hasLogin(xhr.responseText);

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
                var doc = new DOMParser().parseFromString(xhr.responseText, "text/html");
                var sc = new SimhashComputer();
                var ph = new PageHash(sc.getTextSimhash(doc.body.innerText),
                    sc.getDomSimhash(doc.documentElement));
                verdict.spiderPageHash.push(ph);

                var textDist = verdict.pageHash.text.hammingDistance(verdict.spiderPageHash[0].text);
                var domDist = verdict.pageHash.dom.hammingDistance(verdict.spiderPageHash[0].dom);

                if (textDist > this.textThreshold && domDist > this.domThreshold) {
                    var reason = "User copy and browser copy are significantly different.";
                    verdict.setResult(true, reason);
                } else {
                    var reason = "User copy and browser copy are similar.";
                    verdict.setResult(false, reason);
                }
            }
            console.log(verdict);
            chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {message: JSON.stringify(verdict)}, null);
            });

            // when everything is done, we want to update the cookie table.
            if (!hasCookie) {
                parent.cookieSet.hasCookieForDomain(verdict.hostname, function (cookieCount) {
                    if (cookieCount > 0) {
                        parent.cookieSet.update(verdict.hostname, cookieCount);
                    }
                });
            }
        }
    }.bind(this);
    xhr.send();
}

CloakingChecker.prototype.cloakingVerdict = function (request, tabId, sendResponse) {
    var url = request.url;
    var host = request.hostname;
    var pageHash = request.pageHash;
    if (pageHash != null) {
        // PageHash contains function that we want to use, initialize it.
        pageHash = new PageHash(new SimhashItem(pageHash.text.value), new SimhashItem(pageHash.dom.value));
        var v = new Verdict(url, host, pageHash);
        // If we are requesting with pageHash set, the response is going to be sent back using message.
        this.checkCloaking(v);
    } else {
        var v = new Verdict(url, host, null);
        var hostResult = this.visibleHostCache.matchesHost(tabId, host);
        if (hostResult.result) {
            var reason = "Visible hostname and landing hostname are different, this is redirect cloaking. Visible" +
                " host is: " + hostResult.visibleHost + ", landing hostname is: " + hostResult.landingHost;
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
}

var checker = new CloakingChecker();
checker.setRequestUserAgent(Contants.googleSearchBotUA);

// Listen for message from each tab
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        request = JSON.parse(request.message);
        console.log("request is ", request);
        if (request.from == MessageContants.FromSearchPage) {
            console.log("clicked a link to visible url ", request.url);
            checker.visibleHostCache.setVisibleHostCache(request.url, sender.tab.id);
        } else if (request.from == MessageContants.FromLandingPage) {
            checker.cloakingVerdict(request, sender.tab.id, sendResponse);
        }
    }
);

console.log("The cloaking checker is running");
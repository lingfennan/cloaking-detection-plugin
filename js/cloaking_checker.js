/**
 * Created by ruian on 7/18/15.
 */

// The main function to check cloaking and communicate with content scripts.
function CloakingChecker() {
    this.whitelist = new CheckingSet("res/whitelist.json");
    this.blacklist = new CheckingSet("res/blacklist.json");
    this.cookieset = new CookieSet();

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
     *      pageHash: the summary of what user sees
     *      domain: the domain corresponding to url
     */
    console.log("I am doing a background request and computing the decision here.");

    /* Fetches url with crawler user agent in the background.
     */
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
            console.log("cookieset size");
            console.log(this.cookieset);
            console.log(Object.keys(this.cookieset).length);
            var hasCookie = this.cookieset.contains(verdict.domain);
            var hasLogin = HelperFunctions.hasLogin(xhr.responseText);

            if (hasCookie && hasLogin) {
                /* If current page is login page and user has visited it before, then probably user vs. spider will be
                 * different, e.g. Facebook.
                 */
                console.log("If a page has cookie and is has login words, then we skip it. This may have introduce" +
                    " false negative");
                verdict.setResult(false);
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
                    verdict.setResult(true);
                } else {
                    verdict.setResult(false);
                }
            }
            console.log(verdict);
            chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {url: verdict.url, result: verdict.result}, null);
            });

            // when everything is done, we want to update the cookie table.
            if (!hasCookie) {
                var parent = this;
                parent.cookieset.hasCookieForDomain(verdict.domain, function(cookieCount) {
                    if (cookieCount > 0) {
                        parent.cookieset.update(domain, cookieCount);
                    }
                });
            }
        }
    }.bind(this);
    xhr.send();
}

CloakingChecker.prototype.cloakingVerdict = function (url, pageHash, host, sendResponse) {
    if (pageHash != null) {
        var ph = new PageHash(new SimhashItem(pageHash.text), new SimhashItem(pageHash.dom));
        var v = new Verdict(url, ph, host);
        // If we are requesting with pageHash set, the response is going to be sent back using message.
        this.checkCloaking(v);
    } else {
        var v = new Verdict(url, pageHash);
        if (this.whitelist.contains(url)) {
            v.setResult(false);
        } else if (this.blacklist.contains(url)) {
            v.setResult(true);
        } else {
            // else do nothing and return
            v.setResult(null);
        }
        // Send response back to the content script
        sendResponse({url: v.url, result: v.result});
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
        console.log("request is ", request);
        checker.cloakingVerdict(request.url, request.pageHash, request.host, sendResponse);
    }
);

console.log("The cloaking checker is running");
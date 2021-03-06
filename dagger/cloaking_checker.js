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
    // mode set by the user, default to online
    this.cloakerCatcherMode = Contants.modeOnline;
    // parameters from the paper
    this.textRadius = 15;
    this.domRadius = 13;
    this.textSigmaThreshold = 2.1;
    this.domSigmaThreshold = 1.8;
    this.remoteUrl = Contants.serverAddress;
    this.loggingUrl = Contants.loggingAddress;
}

CloakingChecker.prototype.getModeName = function () {
    return this.cloakerCatcherMode;
};

CloakingChecker.prototype.sendVerdictToCS = function(verdict) {
    /*
     * This function is used to send verdict to content script.
     */
    // TODO: Which tab should we send the information to
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {message: JSON.stringify(verdict)}, null);
    });
};

CloakingChecker.prototype.postLogData = function(computeLog, compareLog) {
    var formData = new FormData();
    formData.append("log_computation", computeLog);
    formData.append("log_comparison", compareLog);
    var logPost = new XMLHttpRequest();
    logPost.open('POST', this.loggingUrl, true);
    logPost.onload = function () {
        //console.log(this.responseText);
    };
    logPost.send(formData);
};

CloakingChecker.prototype.handleFetchComplete = function (verdict) {
    /*
     * Call this function when the result is not directly available and needs further computation.
     */
    if (this.getModeName() == Contants.modeOnline) {
        // If any of the model matches, then we consider it match.
        console.log("in mode online");

        // Measure the model comparison time.
        var t0 = performance.now();
        var matched = false;
        for (var i in verdict.textModels) {
            var model = verdict.textModels[i];
            var dist = model.modelDistance(verdict.pageHash.text);
            console.log("text model distance " + dist);
            if (model.matchesModel(dist, this.textRadius, this.textSigmaThreshold)) {
                matched = true;
                break;
            }
        }
        console.log("matched model distance " + matched);

        if (!matched) {
            for (var i in verdict.domModels) {
                var model = verdict.domModels[i];
                var dist = model.modelDistance(verdict.pageHash.dom);
                console.log("dom model distance " + dist);
                if (model.matchesModel(dist, this.domRadius, this.domSigmaThreshold)) {
                    matched = true;
                    break;
                }
            }
        }
        var t1 = performance.now();
        var message = "{\"URL\": \"" + verdict.url + "\", \"Comparison Time(milliseconds)\": " + (t1 - t0) + "}";
        console.log(message);
        // Post the data to the server for logging purpose.
        this.postLogData(verdict.log_computation, message);

        if (matched) {
            var reason = "User copy and browser copy matches.";
            verdict.setResult(false, reason);
        } else {
            var reason = "User copy and browser copy are significantly different.";
            verdict.setResult(true, reason);
        }
    } else if (this.getModeName() == Contants.modeOffline) {
        var textDist = verdict.pageHash.text.hammingDistance(verdict.spiderPageHash[0].text);
        var domDist = verdict.pageHash.dom.hammingDistance(verdict.spiderPageHash[0].dom);

        if (textDist > this.textRadius && domDist > this.domRadius) {
            var reason = "User copy and browser copy are significantly different.";
            verdict.setResult(true, reason);
        } else {
            var reason = "User copy and browser copy are similar.";
            verdict.setResult(false, reason);
        }
    }
    console.log(verdict);
    this.sendVerdictToCS(verdict);
};

CloakingChecker.prototype.getModelAndCompare = function (url, pageHash, verdict) {
    /*
     * Request is very simple:
     * Just a post with parameter url=$URL_TO_LOOKUP
     *
     * Response have two types:
     * 1. the server already knows about this website ( or doesn't know anything about this website, false)
     * type == "result"
     * 2. the server has collected multiple copies of the website and built textModels
     * type == "model"
     * {type: result,
     *  result: true | false,
     *  reason: 'some string'}
     *  or
     * {type: model,
     *  text: [{size, centroid, linkHeights},
     *         {...text pattern2...}
     *        ],
     *  dom: [{size, centroid, linkHeights},
     *        {...dom pattern 2...}
     *       ]
     * }
     */
    var parent = this;
    var xhr = new XMLHttpRequest();
    var params = "url=" + url;
    xhr.open('POST', this.remoteUrl, true);

    /* Simulate form data, so that the parameters will show up in request.POST.
     * If the data is sent directly in POST, it will show up in request.body.
     */
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("Content-length", params.length);
    xhr.setRequestHeader("Connection", "close");

    xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            if (xhr.status == 200) {
                console.log(xhr.responseText);
                // The server send back information in the format of JSON.
                var response = JSON.parse(xhr.responseText);
                if (response.type == Contants.serverResponseResult) {
                    // If the server already knows the result.
                    verdict.setResult(response.result, response.reason);
                    parent.sendVerdictToCS(verdict);
                } else if (response.type == Contants.serverResponseModel) {
                    // If the server just have the text and dom models, the decision is left to user.
                    // Get the models returned by server and compute decision.
                    console.log("in on state ready change");
                    for (var i in response.text) {
                        model = response.text[i];
                        verdict.addTextModel(new SWM(model.size, model.centroid, model.link_heights));
                    }
                    for (var i in response.dom) {
                        model = response.dom[i];
                        verdict.addDomModel(new SWM(model.size, model.centroid, model.link_heights));
                    }
                    parent.handleFetchComplete(verdict);
                }
            }
            else {
                var reason = "The server doesn't have the model for current page. We want fail-safe, so set result " +
                    "to false";
                console.log(reason);
                verdict.setResult(false, reason);
            }
        }
    };
    xhr.send(params);
};

CloakingChecker.prototype.cacheUrlCheckCloakingOnline = function (verdict) {
    this.getModelAndCompare(verdict.cacheUrl, verdict.pageHash, verdict);
};

CloakingChecker.prototype.visibleUrlCheckCloakingOnline = function (verdict) {
    this.getModelAndCompare(verdict.url, verdict.pageHash, verdict);
};

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
                    this.handleResponseTextOffline(validResponseText, verdict);
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

CloakingChecker.prototype.handleResponseTextOffline = function (reponseText, verdict) {
    // Called when content fetch is ready.
    var doc = new DOMParser().parseFromString(reponseText, "text/html");
    var sc = new SimhashComputer();
    var ph = new PageHash(sc.getTextSimhash(doc.body.innerText),
        sc.getDomSimhash(doc.documentElement));
    verdict.spiderPageHash.push(ph);
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
                    this.sendVerdictToCS(verdict);
                } else {
                    /* If it is not login page, then compute simhash and return verdict.
                     * The program already fetched one copy.
                     */
                    if (verdict.fetchAlmostComplete()) {
                        parent.handleResponseTextOffline(this.responseText, verdict);
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
                                    parent.handleResponseTextOffline(this.responseText, verdict);
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
                        parent.handleResponseTextOffline(this.responseText, verdict);
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
                this.sendVerdictToCS(verdict);
            }
        }
    }.bind(xhrArray[0]);
    xhrArray[0].send();
};

CloakingChecker.prototype.cloakingVerdict = function (request, tabId, sendResponse) {
    /* Generate verdict for the given request.
     *
     * 1. if mode is unguarded, always return false.
     * 2. if mode is offline, request a spider copy if necessary.
     * 3. if mode is online, contact server for the Simhash-based Website Model if necessary.
     */
    var url = request.url;
    var host = request.hostname;
    var pageHash = request.pageHash;

    /* Get the selected mode. */
    var mode = this.getModeName();
    // If mode is unguarded.
    if (mode == Contants.modeUnguarded) {
        var v = new BGVerdictMsg(url, host);
        var reason = "Mode Unguarded.";
        v.setResult(false, reason);
        sendResponse(v);
        return;
    }
    /* If mode is offline or online. */
    if (pageHash != null) {
        // PageHash contains function that we want to use, initialize it.
        pageHash = new PageHash(new SimhashItem(pageHash.text.value), new SimhashItem(pageHash.dom.value));
        // Online only fetch model from the server, offline either fetches the cached copy or by itself.
        if (mode == Contants.modeOnline) {
            var v = new BGVerdictMsg(url, host, pageHash);
            // The log is only used in online mode.
            v.log_computation = request.log_computation;
            this.visibleUrlCheckCloakingOnline(v);
        } else if (mode == Contants.modeOffline) {
            // If google search provides link to their cache, we fetch that copy.
            var cacheUrl = this.cacheUrlCache.popValue(tabId);
            if (cacheUrl && cacheUrl.indexOf(HelperFunctions.removeSchemeFromUrl(url)) != -1) {
                var v = new BGVerdictMsg(url, host, pageHash, cacheUrl);
                // Use cached url to fetch spider copy.
                this.cacheUrlCheckCloakingOffline(v);
            } else {
                var v = new BGVerdictMsg(url, host, pageHash);
                this.visibleUrlCheckCloakingOffline(v);
            }
        }
    } else {
        /* Light-weight checking is the same for both offline and online mode. */
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
    function header_modifier (info) {
        // Replace the User-Agent header
        console.log("Changing headers before request!")
        var headers = info.requestHeaders;
        headers.forEach(function (header, i) {
            if (header.name.toLowerCase() == 'user-agent') {
                header.value = userAgent;
            }
        });
        return {requestHeaders: headers};
    }

    if (!chrome.webRequest.onBeforeSendHeaders.hasListener(header_modifier)) {
        chrome.webRequest.onBeforeSendHeaders.addListener(
            header_modifier,
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
        console.log("header_modifier is set");
    } else {
        var err_msg = 'header_modifer is already there!';
        console.error(err_msg);
    }
};

// ----------- Initialization -----------
// Global variable checker.
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
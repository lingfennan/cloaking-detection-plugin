/* This script gets current url, check against the background script to see whether it is known. If not, compute
 * simhash of current page and ask the background script for final verdict.
 *
 * The workflow is:
 * 1. If current page is google search (url starts with: https://www.google.com/#q), find all the search and ad links,
 * add onclick events to them. the onclick event will get the clicked url (visible url). sent it to the background
 * script for caching.
 * 2. Check current url and referer, if current url is not google.com and referer is google.com, go to 3, o.w. ignore.
 * 3. Send url to the background script
 *  a. check current url against visible url (cached through onclick event), if domain mismatch, work on verdict(warn).
 *  b. see whether verdict is already known. If not, go to 4, o.w. work on verdict.
 * 4. Compute text and dom hash for current page, send them to background script, and work on returned verdict.
 */

// window.location.hostname: example.org
// window.location.host: example.org:8888
var tabHost = window.location.hostname;
var refererHost = document.referrer;
var tabURL = window.location.href;
console.log(tabURL);
if (HelperFunctions.searchResultPage(tabURL)) {
    // If current page is search result page, add onclick event for all the search results and search ads
    /*
    console.log($(".g h3 a").length);
    $(".g h3 a").each(function () {
        console.log($(this).attr("href"));
        console.log();
        var googleCacheUrl = $(this).closest(".g").find(".ab_dropdownitem").first().attr("href");
        console.log(googleCacheUrl);
    });
    */

    $(".ads-ad").click(function(event) {
        var visibleUrl = $(this).find(".ads-visurl cite").text();
        var msg = new CSVerdictMsg(visibleUrl, null, null, MessageContants.FromSearchPage);
        chrome.runtime.sendMessage({message: JSON.stringify(msg)}, null);
    });
    $(".g h3 a").click(function(event) {
        var visibleUrl = $(this).attr("data-href");
        var googleCacheUrl = $(this).closest(".g").find("li.action-menu-item.ab_dropdownitem").first().find("a").attr("href");
        var msg = new CSVerdictMsg(visibleUrl, null, null, MessageContants.FromSearchPage, googleCacheUrl);
        chrome.runtime.sendMessage({message: JSON.stringify(msg)}, null);
    });
}
else if (HelperFunctions.interestingPage(tabHost, refererHost)) {
    // TODO: Should we check status code in content script, too?
    // If current page is redirected from google.com, take a look at it.
    console.log("Came from " + refererHost + " and current site is " + tabHost);

    // Send a request to the background script to first check known results
    var msg = new CSVerdictMsg(tabURL, tabHost, null, MessageContants.FromLandingPage);
    chrome.runtime.sendMessage({message: JSON.stringify(msg)},
        function (response) {
            if (response.result == null) {
                // if current page is unknown, we compute the simahsh, send it to the backend for comparison

                // Measure Simhash Computation time.
                var t0 = performance.now();
                var sc = new SimhashComputer();
                var textSimhash = sc.getTextSimhash(document.body.innerText);
                var domSimhash = sc.getDomSimhash(document.documentElement);
                var t1 = performance.now();
                var message = "{\"URL\": \"" + tabURL + "\", \"Computation Time(milliseconds)\": " + (t1 - t0) + "}";
                console.log(message);

                // The second time, we don't pass a callback to the background script, because XmlHttpRequest need to
                // be synchronous in order to change request header in the background.
                //
                // Instead the background script will send a message to the content script later.
                msg.pageHash = new PageHash(textSimhash, domSimhash);
                msg.log_computation = message;
                chrome.runtime.sendMessage({message: JSON.stringify(msg)}, null);
                chrome.runtime.onMessage.addListener(function handleResponse(request, sender, sendResponse) {
                        // One time listener.
                        request = JSON.parse(request.message);
                        console.log(request);
                        chrome.runtime.onMessage.removeListener(handleResponse);
                        // HelperFunctions.alertIfCloaking(request);
                    }
                );
            } else {
                console.log("This is known website, reuse results.");
                // HelperFunctions.alertIfCloaking(response);
            }
        }
    );
}

function getText() {
    return document.body.innerText;
}
function getHTML() {
    return document.body.outerHTML;
}
/* This script gets current url, check against the background script to see whether it is known. If not, compute
 * simhash of current page and ask the background script for final verdict.
 *
 * The workflow is:
 * 1. Check current url and referer, if current url is not google.com and referer is google.com, go to 2, o.w. ignore.
 * 2. Send url to the background script to see whether verdict is already known. If not, go to 3, o.w. work on verdict.
 * 3. Compute text and dom hash for current page, send them to background script, and work on returned verdict.
 */
// window.location.hostname: example.org
// window.location.host: example.org:8888
var tabHost = window.location.hostname;
var refererHost = document.referrer;
// If current page is redirected from google.com, take a look at it.
if (HelperFunctions.interestingPage(tabHost, refererHost)) {
    console.log("Came from " + refererHost + " and current site is " + tabHost);
    var tabURL = window.location.href;
    console.log(tabURL);
    console.log("I am in content");

    // Send a request to the background script to first check known results
    chrome.runtime.sendMessage({url: tabURL, simhash: null}, function (response) {
            if (response.result == null) {
                // if current page is unknown, we compute the simahsh, send it to the backend for comparison
                var sc = new SimhashComputer();
                var textSimhash = sc.getTextSimhash(document.body.innerText);
                var domSimhash = sc.getDomSimhash(document.documentElement);
                var ph = new PageHash(textSimhash, domSimhash);
                chrome.runtime.sendMessage({url: tabURL, simhash: {text: ph.text.value, dom: ph.dom.value}},
                    HelperFunctions.alertIfCloaking);
            } else {
                HelperFunctions.alertIfCloaking(response);
            }
        }
    );
}

function getText () {
    return document.body.innerText;
}
function getHTML () {
    return document.body.outerHTML;
}
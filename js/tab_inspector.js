/* This script gets current url, check against the background script to see whether it is known. If not, fetch another
 * copy with spider agent and compare.
 */
var tabURL = window.location.href;
console.log(tabURL);
console.log("I am in content");

// Send a request to the background script
chrome.runtime.sendMessage({url: tabURL, simhash: null}, function(response) {
        if (response.result == null) {
            // if current page is unknown, we compute the simahsh, send it to the backend for comparison
            var sc = new SimhashComputer();
            var textSimhash = sc.getTextSimhash();
            var domSimhash = sc.getDomSimhash();
            chrome.runtime.sendMessage({url: tabURL, simhash: {text: textSimhash, dom: domSimhash}},
                HelperFunctions.alertIfCloaking);
        } else {
            HelperFunctions.alertIfCloaking(response);
        }
    }
);


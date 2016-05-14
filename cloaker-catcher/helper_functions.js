/**
 * Created by ruian on 7/22/15.
 */

// Util functions.
var HelperFunctions = {
    nonempty: function (a) {
        return a.filter(function (item) {
            return item != "";
        });
    },
    uniq: function (a) {
        var seen = {};
        return a.filter(function (item) {
            return seen.hasOwnProperty(item) ? false : (seen[item] = true);
        });
    },
    ngram: function (textArray, n) {
        var res = [];
        for (i = 0; i < textArray.length - (n - 1); i++) {
            var tmpstr = textArray.slice(i, i + n).join(" ");
            res.push(tmpstr);
        }
        return res;
    },
    getNodeStr: function (node) {
        /* Get the string representation of a node
         *
         * For example: <a href="">Hello World</a> is represented by a_href
         * TODO: should we convert the nodeStr to lower case?
         *
         * Args:
         *  node: the input node
         * Returns:
         *  nodeStr: string representation of the node
         */
        var nodeStr = node.tagName;
        var attrs = node.attributes;
        if (attrs) {
            for (var i = 0; i < attrs.length; i++) {
                nodeStr += "_" + attrs[i].name;
            }
        }
        return nodeStr;
    },
    extractOneNode: function (node) {
        /* Extract dom information related to node.
         *
         * Dom information is defined as nodeStr, <pNodeStr, nodeStr>,
         * <gNodeStr, pNodeStr, nodeStr>.
         *
         * Args:
         *  node: the input node
         * Returns:
         *  resultSet: set containing the dom string information related to current node.
         */
        function validNode(node) {
            return node && node.tagName;
        }

        var resultSet = {};
        if (!validNode(node)) {
            return resultSet;
        }
        var nodeStr = this.getNodeStr(node);
        resultSet[nodeStr] = true;
        var pNode = node.parentNode;
        if (validNode(pNode)) {
            var pNodeStr = this.getNodeStr(pNode) + "," + nodeStr;
            resultSet[pNodeStr] = true;

            var gNode = pNode.parentNode;
            if (validNode(gNode)) {
                var gNodeStr = this.getNodeStr(gNode) + "," + pNodeStr;
                resultSet[gNodeStr] = true;
            }
        }
        return resultSet;
    },
    breadthTraversal: function (root) {
        /* Traverse the given tree and return a set of dom features.
         */
        var queue = [];
        var resultSet = {};
        queue.push(root);
        while (queue.length > 0) {
            // deal with current node
            var topNode = queue.shift();
            var tempSet = this.extractOneNode(topNode);
            for (var t in tempSet) {
                resultSet[t] = true;
            }
            var children = topNode.children;
            // go deeper
            for (var i = 0; i < children.length; ++i) {
                var child = children[i];
                // go deeper
                queue.push(child);
            }
        }
        return resultSet;
    },
    interestingPage: function (tabHost, refererHost) {
        // A page is an interesting page, if it is not google.com and is redirected from google.com.
        return refererHost && refererHost.match(/^https?:\/\/([^\/]+\.)?google\.com(\/|$)/i) && !(tabHost.match(/google\.com/i));
        //return true;  // TODO: Return true because we want to compute and compare every time. Remove later.
    },
    searchResultPage: function (url) {
        return url.match(/^https:\/\/www\.google\.com\/#q/i) || url.match(/^https:\/\/www\.google\.com\/search/i);
    },
    alertIfCloaking: function (response) {
        console.log("In alertIfCloaking");
        console.log(response.url);
        console.log(response.result);
        if (response.result == true) {
            var r = confirm("This page is potentially cloaking! Because " + response.reason +
                "\nDo you want to continue?");
            if (r == true) {
                console.log("User pressed Yes!");
            } else {
                window.location.replace("https://www.google.com");
                console.log("User pressed No!");
            }
        }
    },
    getHexRepresentation: function (num, symbols) {
        /* Get the hex representation num. symbols specifies the width.
         *
         * Another option is:
         *   hexString = yourNumber.toString(16);
         *   yourNumber = parseInt(hexString, 16);
         *
         * Args:
         *  num: the number to format.
         *  symbols: number of digits in the output
         *
         * Returns:
         *  hex representation of number.
         */
        var hex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
        // var symbols = 8;
        var result = '';
        while (symbols--) {
            result = hex[num & 0xF] + result;
            num >>= 4;
        }
        return result;
    },
    hasLogin: function (text) {
        var loginArray = ["login", "log in", "LogIn", "Log In", "LOGIN", "LOG IN", "iniciar sesión", "s'identifier",
            "Einloggen", "ログイン", "로그인", "登陆"];
        var len = loginArray.length;
        while (len--) {
            if (text.indexOf(loginArray[len]) != -1) {
                // one of the sub-strings is in yourstring
                return true;
            }
        }
        return false;
    },
    parseHostFromUrl: function (url) {
        // var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
        var match = url.match(/:\/\/([^/:]+)/i);
        if (match != null && match.length > 1 &&
            typeof match[1] === 'string' && match[1].length > 0) {
            return match[1];
        } else {
            return null;
        }
    },
    isErrorPage: function (htmlText) {
        var title = htmlText.match(/<title>(.*?)<\/title>/m);
        if (title) {
            return (title[1].indexOf("Error 404") != -1);
        } else {
            return false;
        }
    },
    removeSchemeFromUrl: function (url) {
        return url.replace(/^https?:\/\//, "");
    },
    average: function (a) {
        /*
         * Args:
         *  vector: array containing numbers
         * Returns:
         *  an object with 3 properties, they are:
         *   mean: arithmetic mean of the elements
         *   variance: variance
         *   deviation: standard deviation
         */
        var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
        for (var m, s = 0, l = t; l--; s += a[l]);
        for (m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
        return r.deviation = Math.sqrt(r.variance = s / t), r;
    },
    // Deprecated. Open the log file for time logging.
    saveToFile: function (filename, content) {
        chrome.fileSystem.chooseEntry(
            {type: 'saveFile', suggestedName: filename || 'overhead_logging.txt'},
            function (writableFileEntry) {
                writableFileEntry.createWriter(function (writer) {
                    var blob = new Blob([content]);

                    writer.onwriteend = function (e) {
                        console.log("Save complete");
                    };
                    writer.write(blob);
                }, errorHandler);  // errorHandler is not implemented
            }
        );
    }
};

// Constant values.
var MessageContants = {
    FromSearchPage: "Search",
    FromLandingPage: "Landing",
};

// An verdict for program to pass and check.
function Verdict(url, hostname, pageHash) {
    this.url = url;
    this.hostname = hostname || null;
    this.pageHash = pageHash || null;

}

// Message used by content script to transfer information to background.
function CSVerdictMsg(url, hostname, pageHash, from, cacheUrl) {
    Verdict.call(this, url, hostname, pageHash);
    this.from = from;
    this.cacheUrl = cacheUrl || null;
}

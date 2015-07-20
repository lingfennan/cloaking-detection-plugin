/**
 * Created by ruian on 7/19/15.
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
    getNodeStr: function(node) {
        var node_str = node.tagName;
        for (var attr in node.attributes) {
            node_str += "_" + attr;
        }
    },
    extractOneNode: function (node) {
        var resultSet = {};
        var nodeStr = this.getNodeStr(node);
        resultSet[nodeStr] = true;
        var pNode = node.parentNode;
        if (pNode) {
            var pNodeStr = this.getNodeStr(pNode) + "," + nodeStr;
            resultSet[pNodeStr] = true;

            var gNode = pNode.parentNode;
            if (gNode) {
                var gNodeStr = this.getNodeStr(gNode) + "," + pNodeStr;
                resultSet[gNodeStr] = true;
            }
        }
        return resultSet;
    },
    breadthTraversal: function (node) {
        var queue = [];
        var resultSet = {};
        queue.push(node);
        while (queue.length > 0) {
            // deal with current node
            var topNode = queue.shift();
            var tempSet = this.extractOneNode(topNode);
            for(var t in tempSet) {
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
    getText: function () {
        return document.body.innerText;
    },
    getHTML: function () {
        return document.body.outerHTML;
    },
    alertIfCloaking: function (response) {
        console.log("In alertIfCloaking");
        console.log(response.url);
        console.log(response.result);
        if (response.result == true) {
            alert("This page is potentially cloaking!");
        }
    }
};

// The simhash computer
function SimhashComputer() {
    this.hashsize = 64;
    this.algorithm = "md5";
    this.outlierthreshold = 2.4;
}

SimhashComputer.prototype.buildByFeatures = function (features) {
    //set initial param
    var range = 64;
    var wordSize = 32;
    var hashs = [];
    for (var i = 0; i < features.length; i++) {
        var hash = CryptoJS.MD5(features[i]);
        hashs.push(hash);
    }
    var vec = [];
    var vecLength = range;
    for (var i = 0; i < vecLength; i++) {
        vec.push(0);
    }

    var masks = [];
    var masksLength = range;
    for (var i = 0; i < masksLength; i++) {
        masks.push(1 << i);
    }

    for (var h in hashs) {
        for (var w = 0; w < range / wordSize; w++) {
            for (var i = 0; i < wordSize; i++) {
                if (hashs[h].words[w] & masks[i]) vec[i + w * wordSize] += 1;
                else vec[i + w * wordSize] -= 1;
            }
        }
    }

    ans = 0;
    for (i = 0; i < range; i++) {
        if (vec[i] >= 0)
            ans |= masks[i];
    }
    return ans;
}

SimhashComputer.prototype.getTextSimhash = function () {
    //get visible text
    var rawText = HelperFunctions.getText();
    var textArr = HelperFunctions.nonempty(rawText.split(/[^A-Za-z0-9]/));
    var text = textArr.toString();

    var textSet = HelperFunctions.uniq(textArr);
    var bigram = HelperFunctions.ngram(textArr, 2);
    var trigram = HelperFunctions.ngram(textArr, 3);

    // get text features
    var hashText = textSet.concat(bigram.concat(trigram));
    console.log(hashText);
    var textHashVal = this.buildByFeatures(hashText);
    console.log(textHashVal);
    return textHashVal;
}

SimhashComputer.prototype.getDomSimhash = function () {
    // get dom features
    var dom_features = HelperFunctions.breadthTraversal(document.documentElement);
    var domHashVal = this.buildByFeatures(dom_features);
    return domHashVal;
}

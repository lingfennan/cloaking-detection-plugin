/**
 * Created by ruian on 7/19/15.
 */

// Simhash object
function PageHash(text, dom) {
    this.text = text;
    this.dom = dom;
}

// The simhash item
function SimhashItem(hexStr) {
    this.value = hexStr;
    // assuming that the simhash is 64 bit.
    this.high = hexStr.substr(0, 8);
    this.low = hexStr.substr(8, 8);
    this.bits = hexStr.length * 4;
}

SimhashItem.prototype.getValue = function(radix) {
    if (radix == 2) {
        var zeros = "00000000000000000000000000000000";
        var h = parseInt(this.high, 16).toString(2);
        h = zeros.substr(h.length) + h;
        var l = parseInt(this.low, 16).toString(2);
        l = zeros.substr(l.length) + l;
        return h + l;
    } else if (radix == 16) {
        return this.value;
    } else if (radix == 10) {
        console.log("This method is problematic because we are dealing with large integer.")
        return parseInt(this.high, 16).toString(10) + parseInt(this.low, 16).toString(10);
    } else {
        console.log("Unsupported radix");
    }
}

SimhashItem.prototype.hammingDistance = function (itemB){
    if (!itemB instanceof SimhashItem) {
        return null;
    }
    var dist = 0;
    var aStr = this.getValue(2);
    var bStr = itemB.getValue(2);
    for (var i=0; i<aStr.length; i++) {
        if (aStr[i] != bStr[i]) {
            dist += 1;
        }
    }
    return dist;
}

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
    var masksLength = wordSize;
    // prepare masks
    for (var i = 0; i < masksLength; i++) {
        masks.push((1 << i) >>> 0);
    }
    // compute vector
    for (var h in hashs) {
        for (var w = 0; w < range / wordSize; w++) {
            for (var i = 0; i < wordSize; i++) {
                if (hashs[h].words[w] & masks[i]) vec[i + w * wordSize] += 1;
                else vec[i + w * wordSize] -= 1;
            }
        }
    }
    // take the sign of each item in vector as result
    var ansWords = [];
    for (var w = 0; w < range / wordSize; w++) {
        var ans = 0;
        for (var i = 0; i < wordSize; i++) {
            var index = i + w * wordSize;
            if (vec[index] >= 0) {
                ans |= masks[i];
            }
        }
        ansWords.push(ans >>> 0);
    }
    // return the hex string
    var ansStr = "";
    for (var i in ansWords) {
        ansStr = HelperFunctions.getHexRepresentation(ansWords[i], 8) + ansStr;
    }
    return ansStr;
}

SimhashComputer.prototype.getTextSimhash = function (rawText) {
    //get visible text
    var textArr = HelperFunctions.nonempty(rawText.split(/[^A-Za-z0-9]/));

    var textSet = HelperFunctions.uniq(textArr);
    var bigram = HelperFunctions.ngram(textArr, 2);
    var trigram = HelperFunctions.ngram(textArr, 3);

    // get text features
    var textFeatures = textSet.concat(bigram.concat(trigram));
    // console.log(textFeatures);
    var textHashVal = this.buildByFeatures(textFeatures);
    console.log(textHashVal);
    /*
    console.log(new SimhashItem(textHashVal).getValue(2));
    console.log(new SimhashItem(textHashVal).getValue(16));
    console.log(new SimhashItem(textHashVal).getValue(10));
    */
    return new SimhashItem(textHashVal);
}

SimhashComputer.prototype.getDomSimhash = function (domRoot) {
    // get dom features
    var domSet = HelperFunctions.breadthTraversal(domRoot);
    var domFeatures = Object.keys(domSet);
    // console.log(domFeatures);
    var domHashVal = this.buildByFeatures(domFeatures);
    console.log(domHashVal);
    return new SimhashItem(domHashVal);
}

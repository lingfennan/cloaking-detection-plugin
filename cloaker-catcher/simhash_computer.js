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

// Simhash website model
function SWM (volume, centroid, linkHeights) {
    this.volume = volume;  // number of simhashs
    this.centroid = centroid;  // 64 numbers
    this.linkHeights = linkHeights;  // standard deviation
    this.linkStats = HelperFunctions.average(linkHeights);
    this.modelDistance = function (simhashItem) {
        if (!simhashItem instanceof SimhashItem) {
            return null;
        }
        var dist = 0;
        var aStr = simhashItem.getValue(2);
        for (var i = 0; i < aStr.length; i++) {
            if (aStr[i] == '1') {
                dist += this.volumne - this.centroid[i];
            } else {
                dist += this.centroid[i];
            }
        }
        return dist * 1.0 / this.volume;
    };
    // This is method used to decide whether dist is in model.
    this.matchesModel = function (dist, base, n) {
        /*
         *    y_k_1 = np.mean(link_heights)
         57                                 y_k_2 = np.std(link_heights)
         58                                 z_k_3 = dist - self.detection_config.min_radius
         59                                 thres = self.detection_config.inconsistent_coefficient
         60                                 if (z_k_3 - y_k_1) / y_k_2 < thres:
         61                                         return False
         62                         else:
         63                                 thres = self.detection_config.min_radius
         64                                 if dist < thres:
         65                                         return False

         */
        if (this.linkHeights.length > 0) {
            var y_k_1 = this.linkStats.mean;
            var y_k_2 = this.linkStats.deviation;
            var z_k_3 = dist - base;
            return (z_k_3 - y_k_1) / y_k_2 >= n;
        } else {
            return dist >= base;
        }
    };
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
    /* Since MD5 is 128 bit, and we are only using 64 bit. To be consistent with the server side, we take the lower
     * 64-bit (refer to https://github.com/liangsun/simhash for server side implementation).
     *
     * MD5 hash:
     * 0......0, 1......1, 0......0, 1......1
     * word[0]   word[1]   word[2]   word[3]
     *
     * Use word[2] and word[3].
     */
    var wordTotal = 4;
    for (var h in hashs) {
        for (var w = 0; w < range / wordSize; w++) {
            for (var i = 0; i < wordSize; i++) {
                if (hashs[h].words[wordTotal - w - 1] & masks[i]) vec[i + w * wordSize] += 1;
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

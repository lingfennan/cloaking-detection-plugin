/*
   chrome.browserAction.onClicked.addListener(function(tab) {
   chrome.tabs.executeScript({
   code: 'document.body.style.backgroundColor="red"'
   });
   });

   chrome.tabs.query({'active': true, 'currentWindow': true},
   function(tabs){
   alert(tabs[0].url);
   console.log(tabs[0].url);

   }
   );
   */
var builder = ProtoBuf.loadJsonFile("cloaking_detection.json");



//console.log(getText());
var tabURL = window.location.href;
//get visible text
//var clone = $('#content').clone();
//clone.appendTo('body').find(':hidden').remove();
//var raw_text = clone.text();
var raw_text = getText();
var text_arr = nonempty(raw_text.split(/[^A-Za-z0-9]/));
var text = text_arr.toString();
//clone.remove();
console.log(tabURL);
/*
   chrome.tabs.getSelected(null, function(tab){
   console.log(tab);
   });
   */

var text_set = uniq(text_arr);
//var text_set = removedup(text_arr).toString();
var bigram = ngram(text_arr,2);
var trigram = ngram(text_arr,3);

var hash_text = text_set.concat(bigram.concat(trigram));
console.log(hash_text);
var text_hash_val = buildByFeatures(hash_text);
console.log(text_hash_val);

var dom_features = breadthTraversal(document.documentElement);

/*
   function removedup(arr){
   var unique = [];
   $.each(arr, function(i, el){
   if($.inArray(el, unique) === -1) unique.push(el);
   });
   return unique;
   }
   */

function nonempty(a) {
	return a.filter(function(item) {
		return item == "" ? false : true;
	});
}

function uniq(a) {
	var seen = {};
	return a.filter(function(item) {
		return seen.hasOwnProperty(item) ? false : (seen[item] = true);
	});
}

function ngram(text_array, n){
	var res = [];
	for(i=0; i<text_array.length-(n-1);i++){
		var tmpstr = text_array.slice(i, i+n).join(" ");
		res.push(tmpstr);
	}
	return res;
}

function extract_one_node(node) {
	var resultSet = $();
	var node_str = node.tagName;
	for () {
	}
}

function breadthTraversal(node) {
	var queue = [];
	var resultSet = $();
	queue.push(node);
	while (queue.length > 0) {
		var node = queue.shift();
		var tempSet = extract_one_node(node, resultSet);
		for (
		resultSet.push($child[0]); //well, we found one
		var children = node.children();
		for (var i = 0; i < children.length; ++i) {
			var $child = $(children[i]);
			queue.push($child); //go deeper
		}
	}
	return resultSet;
}

function buildByFeatures(features){
	//set inintial param
	var range = 64;
	var word_size = 32;
	var hashs = []; 
	for(var i=0; i<features.length; i++) {
		var hash = CryptoJS.MD5(features[i]);
		hashs.push(hash);
	}
	var vec = [];
	var vec_length = range;
	for(var i=0; i<vec_length; i++){
		vec.push(0);
	}

	var masks = [];
	var masks_length = range;
	for(var i=0; i<masks_length; i++){
		masks.push(1<<i);
	}

	for(var h in hashs){
		console.log(hashs[h]);
		for(var w_i=0; w_i<range/word_size; w_i++) {
			for(i=0; i<word_size; i++){
				if (hashs[h].words[w_i] & masks[i]) vec[i + w_i * word_size] += 1;
				else vec[i + w_i * word_size] -= 1;
			}
		}
	}

	ans = 0;
	for(i=0; i<range; i++){
		if(vec[i]>=0)
			ans |= masks[i];
	}
	return ans;
}

function getText(){
	return document.body.innerText 
}

function getHTML(){
	return document.body.outerHTML
}



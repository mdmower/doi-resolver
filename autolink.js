/*!
	Copyright (C) 2016 Matthew D. Mower

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

storage();

function storage() {
	if (typeof storage.area === 'undefined') {
		storage.area = chrome.storage.local;
	}
	if (typeof storage.urlPrefix === 'undefined') {
		storage.urlPrefix = "http://dx.doi.org/";
	}
	if (typeof storage.findDoi === 'undefined') {
		// http://stackoverflow.com/questions/27910/finding-a-doi-in-a-document-or-page
		storage.findDoi = /\b(10[.][0-9]{3,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)\b/ig;
	}
	if (typeof storage.findUrl === 'undefined') {
		// http://stackoverflow.com/questions/27910/finding-a-doi-in-a-document-or-page
		storage.findUrl = /^(?:https?\:\/\/)dx\.doi\.org\/(10[.][0-9]{3,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)$/ig;
	}
	if (typeof storage.autolinkRewrite === 'undefined') {
		storage.autolinkRewrite = false;
	}

	chrome.storage.local.get(["sync_data"], function(stg) {
		if (stg.sync_data === true) {
			storage.area = chrome.storage.sync;
		} else {
			storage.area = chrome.storage.local;
		}

		var stgFetch = [
			"cr_autolink",
			"auto_link_rewrite",
			"custom_resolver",
			"doi_resolver"
		];

		storage.area.get(stgFetch, function(stg) {
			if (stg.custom_resolver === true && stg.cr_autolink == "custom") {
				storage.urlPrefix = stg.doi_resolver;
				storage.autolinkRewrite = stg.auto_link_rewrite === true;
			}
			replaceDOIsWithLinks();
		});
	});
}

// http://stackoverflow.com/questions/1444409/in-javascript-how-can-i-replace-text-in-an-html-page-without-affecting-the-tags
function replaceDOIsWithLinks() {
	replaceInElement(document.body, storage.findDoi, function(match) {
		var link = document.createElement('a');
		link.href = storage.urlPrefix + match[0];
		link.appendChild(document.createTextNode(match[0]));
		return link;
	});
}

// iterate over child nodes in reverse, as replacement may increase length of child node list.
function replaceInElement(element, find, replace) {
	// don't touch these elements
	var forbiddenTags = ["a", "input", "script", "style", "textarea"];
	for (var i = element.childNodes.length; i-- > 0;) {
		var child = element.childNodes[i];
		if (child.nodeType == 1) { // ELEMENT_NODE
			if (forbiddenTags.indexOf(child.nodeName.toLowerCase()) < 0) {
				replaceInElement(child, find, replace);
			} else if (storage.autolinkRewrite && child.nodeName.toLowerCase() == "a") {
				if (storage.findUrl.test(child.href)) {
					child.href = child.href.replace(storage.findUrl, storage.urlPrefix + "$1");
				}
			}
		} else if (child.nodeType == 3) { // TEXT_NODE
			replaceInText(child, find, replace);
		}
	}
}

function replaceInText(text, find, replace) {
	var match;
	var matches = [];
	while ((match = find.exec(text.data)) !== null) {
		matches.push(match);
	}
	for (var i = matches.length; i-- > 0;) {
		match = matches[i];
		text.splitText(match.index);
		text.nextSibling.splitText(match[0].length);
		text.parentNode.replaceChild(replace(match), text.nextSibling);
	}
}

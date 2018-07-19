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

definitions();
beginInit();

function definitions() {
    definitions.urlPrefix = "https://dx.doi.org/";
    // https://stackoverflow.com/questions/27910/finding-a-doi-in-a-document-or-page
    definitions.findDoi = /\b(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)\b/ig;
    definitions.findUrl = /^(?:https?\:\/\/)(?:dx\.)?doi\.org\/(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)$/ig;
    definitions.autolinkRewrite = false;
}

function beginInit() {
	var stgFetch = [
		"cr_autolink",
		"auto_link_rewrite",
		"custom_resolver",
		"doi_resolver"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
		if (stg.custom_resolver === true && stg.cr_autolink == "custom") {
			definitions.urlPrefix = stg.doi_resolver;
			definitions.autolinkRewrite = stg.auto_link_rewrite === true;
		}
		replaceDOIsWithLinks();
	});
}

// https://stackoverflow.com/questions/1444409/in-javascript-how-can-i-replace-text-in-an-html-page-without-affecting-the-tags
function replaceDOIsWithLinks() {
	replaceInElement(document.body, definitions.findDoi, function(match) {
		var link = document.createElement('a');
		link.href = definitions.urlPrefix + match[0];
		link.appendChild(document.createTextNode(match[0]));
		return link;
	});
}

// iterate over child nodes in reverse, as replacement may increase length of child node list.
function replaceInElement(element, find, replace) {
	// don't touch these elements
	var forbiddenTags = ["a", "input", "script", "style", "textarea"];
	for (var i = element.childNodes.length - 1; i >= 0; i--) {
		var child = element.childNodes[i];
		if (child.nodeType === Node.ELEMENT_NODE) {
			if (forbiddenTags.indexOf(child.nodeName.toLowerCase()) < 0) {
				replaceInElement(child, find, replace);
			} else if (definitions.autolinkRewrite && child.nodeName.toLowerCase() == "a") {
				if (definitions.findUrl.test(child.href)) {
					child.href = child.href.replace(definitions.findUrl, definitions.urlPrefix + "$1");
				}
			}
		} else if (child.nodeType === Node.TEXT_NODE) {
			replaceInText(child, find, replace);
		}
	}
}

function replaceInText(text, find, replace) {
	var matches = [];
	var match = find.exec(text.data);
	while (match !== null) {
		matches.push(match);
		match = find.exec(text.data);
	}
	for (var i = matches.length - 1; i >= 0; i--) {
		match = matches[i];
		text.splitText(match.index);
		text.nextSibling.splitText(match[0].length);
		text.parentNode.replaceChild(replace(match), text.nextSibling);
	}
}

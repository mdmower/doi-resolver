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

// https://stackoverflow.com/questions/27910/finding-a-doi-in-a-document-or-page
var doiRegex = /^(?:\s*doi:?\s*)?\s*(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&'<>])\S)+)\s*$/i;

startListeners();

function startListeners() {
	var selectHandler = debounce(function () {
		var selection = document.getSelection().toString();
		chrome.runtime.sendMessage({
			cmd: "context_menu_toggle",
			enable: doiRegex.test(selection)
		}, function () {});
	}, 50, false);

	try {
		document.addEventListener("selectionchange", selectHandler);
		// Handle scenario: doi is selected in a window, enabling context menu,
		// then window loses focus and selection in another window disables
		// context menu, and finally original window focused with original DOI
		// text selection still in place.
		window.addEventListener("focus", selectHandler);
	} catch (ex) {
		console.log("DOI context menu selection detection encountered an exception", ex);
	}
}

function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this;
		var args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) {
				func.apply(context, args);
			}
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait || 200);
		if (callNow) {
			func.apply(context, args);
		}
	};
}

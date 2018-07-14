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

document.addEventListener('DOMContentLoaded', function () {
	storage(true);
}, false);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.cmd) {
	case "sync_toggle_complete":
		storage(false);
		break;
	default:
		break;
	}
});

function storage(firstRun) {
	if (typeof storage.area === 'undefined') {
		storage.area = chrome.storage.local;
	}

	chrome.storage.local.get(["sync_data"], function(stg) {
		if (stg.sync_data === true) {
			storage.area = chrome.storage.sync;
		} else {
			storage.area = chrome.storage.local;
		}

		if (firstRun === true) {
			continueOnLoad();
		}
	});
}

function continueOnLoad() {
	restoreOptions();
	getLocalMessages();
	showHideOptionalElms();
	populateHistory();
	startListeners();
}

function startListeners() {
	var resolveSubmit = document.getElementById("resolveSubmit");
	resolveSubmit.addEventListener("click", function() {
		document.getElementById("hiddenButtonInput").value = "doi";
	});
	var citeSubmit = document.getElementById("citeSubmit");
	citeSubmit.addEventListener("click", function() {
		document.getElementById("hiddenButtonInput").value = "cite";
	});
	var qrSubmit = document.getElementById("qrSubmit");
	qrSubmit.addEventListener("click", function() {
		document.getElementById("hiddenButtonInput").value = "qr";
	});
	var optionsSubmit = document.getElementById("optionsSubmit");
	optionsSubmit.addEventListener("click", function() {
		document.getElementById("hiddenButtonInput").value = "options";
	});
	var doiForm = document.getElementById("doiForm");
	doiForm.addEventListener("submit", function(event) {
		event.preventDefault();
		formSubmitHandler();
	});
	var crRadioOptions = Array.from(document.querySelectorAll('input[name="crRadio"]'));
	crRadioOptions.forEach(function(crRadio) {
		crRadio.addEventListener("click", saveOptions);
	});
}

function saveOptions() {
	var options = {
		cr_bubble_last: document.querySelector('input[name="crRadio"]:checked').value
	};

	chrome.storage.local.set(options, null);
}

function restoreOptions() {
	storage.area.get(["cr_bubble_last"], function(stg) {
		if (stg.cr_bubble_last === "custom") {
			document.getElementById("crRadioBubbleCustom").checked = true;
		} else {
			document.getElementById("crRadioBubbleDefault").checked = true;
		}
	});
}

// Clear message space
function resetMessageSpace() {
	var messageDiv = document.getElementById("messageDiv");
	messageDiv.innerHTML = "";
	messageDiv.style.display = "none";
}

// General messaging area in bubble
function bubbleMessage(message) {
	resetMessageSpace();
	var messageDiv = document.getElementById("messageDiv");
	messageDiv.innerHTML = message;
	messageDiv.style.display = "block";
}

// Process the form
function formSubmitHandler() {
	var trim = chrome.extension.getBackgroundPage().trim;
	var actionType = document.getElementById("hiddenButtonInput").value;
	var doiInput = encodeURI(trim(document.getElementById("textInput").value));
	var checkValidDoi = chrome.extension.getBackgroundPage().checkValidDoi;
	var recordDoiAction = chrome.extension.getBackgroundPage().recordDoiAction;

	switch (actionType) {
	case "qr":
		if (checkValidDoi(doiInput)) {
			// Allow DOI recording to happen asynchronously
			recordDoiAction(doiInput);
		}
		// Allow tab to open with invalid DOI
		qrGen(doiInput);
		break;
	case "cite":
		if (checkValidDoi(doiInput)) {
			// Allow DOI recording to happen asynchronously
			recordDoiAction(doiInput);
		}
		// Allow tab to open with invalid DOI
		citeDOI(doiInput);
		break;
	case "doi":
		if (!checkValidDoi(doiInput)) {
			bubbleMessage(chrome.i18n.getMessage("invalidDoiAlert"));
			return;
		}
		// Allow DOI recording to happen asynchronously
		recordDoiAction(doiInput);
		resolveURL(doiInput);
		break;
	case "options":
		if (chrome.runtime.openOptionsPage) {
			chrome.runtime.openOptionsPage(function() {
				window.close();
			});
		} else {
			chrome.tabs.create({url:"options.html"});
			window.close();
		}
		break;
	default:
		break;
	}
}

// Build URL based on custom resolver settings
function resolveURL(doi) {
	var stgFetch = [
		"custom_resolver",
		"cr_bubble",
		"cr_bubble_last",
		"doi_resolver",
		"shortdoi_resolver"
	];

	storage.area.get(stgFetch, function(stg) {
		var url = "";
		var cr = stg.custom_resolver;
		var crb = stg.cr_bubble;
		var crbl = stg.cr_bubble_last;
		var dr = stg.doi_resolver;
		var sr = stg.shortdoi_resolver;
		var useDefaultResolver = true;

		if (cr === true && crb === "custom") {
			useDefaultResolver = false;
		} else if (cr === true && crb === 'selectable' && crbl === 'custom') {
			useDefaultResolver = false;
		}

		if (useDefaultResolver) {
			if (/^10\./.test(doi)) {
				url = "https://dx.doi.org/" + doi;
			} else if (/^10\//.test(doi)) {
				url = "https://doi.org/" + doi.replace(/^10\//,"");
			}
		} else {
			if (/^10\./.test(doi)) {
				url = dr + doi;
			} else if (/^10\//.test(doi)) {
				url = sr + doi.replace(/^10\//,"");
			}
		}

		chrome.tabs.create({url: url});
		window.close();
	});
}

// Open citation formatting page
function citeDOI(doiInput) {
	var citeUrl= "citation.html?doi=" + doiInput;
	chrome.tabs.create({url: citeUrl});
	window.close();
}

// Open QR generator page
function qrGen(doiInput) {
	var qrUrl = "qr.html?doi=" + doiInput;
	chrome.tabs.create({url: qrUrl});
	window.close();
}

// Show or hide additional buttons in bubble
function showHideOptionalElms() {
	var stgFetch = [
		"meta_buttons",
		"custom_resolver",
		"cr_bubble"
	];

	storage.area.get(stgFetch, function(stg) {
		var meta = stg.meta_buttons;
		var crOp = stg.custom_resolver;
		var crbOp = stg.cr_bubble;

		if (meta === true) {
			document.getElementById("metaButtons").style.display = "flex";
		} else {
			document.getElementById("metaButtons").style.display = "none";
		}

		if (crOp === true && crbOp === "selectable") {
			document.getElementById("crRadios").style.display = "block";
		} else {
			document.getElementById("crRadios").style.display = "none";
		}
	});
}

function populateHistory() {
	var stgFetch = [
		"history",
		"recorded_dois",
		"history_showsave",
		"history_showtitles"
	];

	storage.area.get(stgFetch, function(stg) {
		if (!stg.history) {
			return;
		}
		if (!Array.isArray(stg.recorded_dois) || stg.recorded_dois.length < 1) {
			return;
		}

		document.getElementById('historyDiv').style.display = 'block';

		// Skip holes in the array (should not occur)
		stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
			// Use !=, not !==, so that null is caught as well
			return elm != undefined;
		});

		var sortHistoryEntries = chrome.extension.getBackgroundPage().sortHistoryEntries;
		sortHistoryEntries(stg.recorded_dois, stg.history_sortby);

		var escapeHtml = chrome.extension.getBackgroundPage().escapeHtml;
		var optionHtml = "";

		stg.recorded_dois.filter(item => item.save).forEach((item) => {
			var label = stg.history_showtitles && item.title ? escapeHtml(item.title) : item.doi;
			optionHtml += '<option class="save" value="' + item.doi + '">' + label + '</option>';
		});

		if (stg.history_showsave !== true) {
			stg.recorded_dois.filter(item => !item.save).forEach((item) => {
				var label = stg.history_showtitles && item.title ? escapeHtml(item.title) : item.doi;
				optionHtml += '<option value="' + item.doi + '">' + label + '</option>';
			});
		}

		var selectBox = document.getElementById("doiHistory");
		var selectBoxSize = stg.recorded_dois.length > 6 ? 6 : stg.recorded_dois.length;
		selectBoxSize = selectBoxSize < 2 ? 2 : selectBoxSize;
		selectBox.setAttribute('size', selectBoxSize);
		selectBox.selectedIndex = -1;
		selectBox.innerHTML = optionHtml;

		var filterSelectByText = chrome.extension.getBackgroundPage().filterSelectByText;
		var filterInput = function() {
			filterSelectByText(selectBox, this.value, false);
		};

		var filter = document.getElementById("textInput");
		filter.addEventListener('input', filterInput);

		selectBox.addEventListener('change', function() {
			filter.removeEventListener('input', filterInput);
			filter.value = this.value;
			filter.addEventListener('input', filterInput);
			this.selectedIndex = -1;
			resetMessageSpace();
		});
	});
}

function filterByText(select, text) {
	var options = Array.from(select.options);
	var showAll = !text;

	if (showAll) {
		options.forEach(function(option) {
			option.style.display = '';
		});
		if (select.selectedOptions.length > 0) {
			select.selectedOptions[0].scrollIntoView();
		}
	} else {
		// Escape special chars
		var search = text.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
		// Ignore extra whitespace characters
		search = search.replace(/\s* /g, '\\s*');
		var regex = new RegExp(search, 'i');

		var visibleOptions = [];
		options.forEach(function(option) {
			if (regex.test(option.value)) {
				option.style.display = '';
				visibleOptions.push(option);
			} else {
				option.selected = false;
				option.style.display = 'none';
			}
		});

		if (visibleOptions.length > 0) {
			if (select.selectedOptions.length > 0) {
				select.selectedOptions[0].scrollIntoView();
			}
		}
	}
}

function getLocalMessages() {
	var messageIds = [
		"citeSubmit",
		"optionCrCustom",
		"optionCrDefault",
		"optionCrLabelBubble",
		"optionsSubmit",
		"qrSubmit",
		"resolveSubmit"
	];

	var message = "";
	for (var i = 0; i < messageIds.length; i++) {
		message = chrome.i18n.getMessage(messageIds[i]);
		document.getElementById(messageIds[i]).innerHTML = message;
	}
}

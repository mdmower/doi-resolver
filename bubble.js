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

// Remove spaces and punctuation from beginning and end of input
function trim(stringToTrim) {
	return stringToTrim.replace(/^\s*doi:?|\s+|[^A-Z0-9)>]+$/ig, "");
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
	var actionType = document.getElementById("hiddenButtonInput").value;
	var doiInput = encodeURI(trim(document.getElementById("textInput").value));
	var checkValidDoi = chrome.extension.getBackgroundPage().checkValidDoi;
	var recordDoi = chrome.extension.getBackgroundPage().recordDoi;

	switch (actionType) {
	case "qr":
		if (checkValidDoi(doiInput)) {
			recordDoi(doiInput)
			.catch((errMsg) => {
				console.log(errMsg);
			});
		}
		// Allow tab to open with invalid DOI
		qrGen(doiInput);
		break;
	case "cite":
		if (checkValidDoi(doiInput)) {
			recordDoi(doiInput)
			.catch((errMsg) => {
				console.log(errMsg);
			});
		}
		// Allow tab to open with invalid DOI
		citeDOI(doiInput);
		break;
	case "doi":
		if (!checkValidDoi(doiInput)) {
			bubbleMessage(chrome.i18n.getMessage("invalidDoiAlert"));
			return;
		}
		recordDoi(doiInput)
		.catch((errMsg) => {
			console.log(errMsg);
		});
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
		"recorded_dois",
		"history_showsave"
	];

	storage.area.get(stgFetch, function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		// Skip holes in the array (should not occur)
		stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
			// Use !=, not !==, so that null is caught as well
			return elm != undefined;
		});

		var optionHtml = "";
		var message = chrome.i18n.getMessage("historySavedEntryLabel");
		var i;
		for (i = 0; i < stg.recorded_dois.length; i++) {
			if (stg.recorded_dois[i].save) {
				optionHtml += '<option value="' + stg.recorded_dois[i].doi + '" label="' + message + '" />';
			}
		}
		if (stg.history_showsave !== true) {
			for (i = 0; i < stg.recorded_dois.length; i++) {
				if (!stg.recorded_dois[i].save) {
					optionHtml += '<option value="' + stg.recorded_dois[i].doi + '" />';
				}
			}
		}
		document.getElementById("doiHistory").innerHTML = optionHtml;
	});
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

/*!
	Copyright (C) 2015 Matthew D. Mower

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
	startListeners();
}

function startListeners() {
	$("#resolveSubmit").click(function() {
		$("#hiddenButtonInput").val("doi");
	});
	$("#citeSubmit").click(function() {
		$("#hiddenButtonInput").val("cite");
	});
	$("#qrSubmit").click(function() {
		$("#hiddenButtonInput").val("qr");
	});
	$("#optionsSubmit").click(function() {
		$("#hiddenButtonInput").val("options");
	});
	$('#doiForm').submit(function () {
		formSubmitHandler();
		return false;
	});
	$("input[name='crRadio']").on("click", saveOptions);
}

function saveOptions() {
	var options = {
		cr_bubble_last: $('input[name="crRadio"]:checked').val()
	};

	chrome.storage.local.set(options, null);
}

function restoreOptions() {
	storage.area.get(["cr_bubble_last"], function(stg) {
		if (stg.cr_bubble_last === "custom") {
			$("#crRadioBubbleCustom").prop("checked", true);
		} else {
			$("#crRadioBubbleDefault").prop("checked", true);
		}
	});
}

// Remove spaces and punctuation from beginning and end of input
function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

// Check that DOI is valid and warn user if not (in bubble)
function checkValidDoi(doiInput) {
	if (/^10\./.test(doiInput)) {
		return true;
	} else if (/^10\//.test(doiInput)) {
		return true;
	} else {
		bubbleMessage(chrome.i18n.getMessage("invalidDoiAlert"));
		return false;
	}
}

// Clear message space
function resetMessageSpace() {
	$("#messageDiv").empty();
	$("#messageDiv").css("display", "none");
}

// General messaging area in bubble
function bubbleMessage(message) {
	resetMessageSpace();
	$("#messageDiv").css("display", "block");
	$("#messageDiv").html(message);
}

// Process the form
function formSubmitHandler() {
	var actionType = $("#hiddenButtonInput").val();
	var doiInput = encodeURI(trim($("#textInput").val()));

	switch (actionType) {
	case "qr":
		qrGen(doiInput);
		break;
	case "cite":
		citeDOI(doiInput);
		break;
	case "doi":
		if (doiInput.length === 0 || !checkValidDoi(doiInput)) return;
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
				url = "http://dx.doi.org/" + doi;
			} else if (/^10\//.test(doi)) {
				url = "http://doi.org/" + doi.replace(/^10\//,"");
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
			$("#metaButtons").css("display", "flex");
		} else {
			$("#metaButtons").css("display", "none");
		}

		if (crOp === true && crbOp === "selectable") {
			$("#crRadios").css("display", "block");
		} else {
			$("#crRadios").css("display", "none");
		}
	});
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("resolveSubmit");
	$("#resolveSubmit").attr("value", message);
	message = chrome.i18n.getMessage("citeSubmit");
	$("#citeSubmit").attr("value", message);
	message = chrome.i18n.getMessage("optionsSubmit");
	$("#optionsSubmit").attr("value", message);
	message = chrome.i18n.getMessage("optionCrLabelBubble");
	$("#optionCrLabelBubble").html(message);
	message = chrome.i18n.getMessage("optionCrCustom");
	$("#optionCrCustom").html(message);
	message = chrome.i18n.getMessage("optionCrDefault");
	$("#optionCrDefault").html(message);
}

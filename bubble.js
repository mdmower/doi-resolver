/*
	Copyright (C) 2013 Matthew D. Mower

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
	restoreOptions();
	getLocalMessages();
	showHideOptionalElms();
	setTextBoxWidth();
	startListeners();
}, false);

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
	$('#doiForm').submit(function () {
		formSubmitHandler();
		return false;
	});
	$("input[name='crRadio']").on("click", saveOptions);
}

// Saves options to localStorage
function saveOptions() {
	localStorage["cr_last"] = $('input[name="crRadio"]:checked').val();
}

// Restores options from localStorage
function restoreOptions() {
	var crlOp = localStorage["cr_last"];

	if(crlOp == "custom") {
		$("#crRadioBubbleCustom").prop("checked", true);
	} else {
		$("#crRadioBubbleDefault").prop("checked", true);
	}
}

// Dynamically adjust bubble height when content changes
function resetBubbleHeight() {
	var bubbleHeight = document.getElementById("containerDiv").offsetHeight;
	$("body").css("height", bubbleHeight + "px");
}

// Set text box width to fill all space between label and button
function setTextBoxWidth() {
	// Read: http://www.alistapart.com/articles/holygrail
	// DOI label doesn't align right when following guide exactly

	var doiLabelWidth = $("#formDoiLabel").outerWidth() + "px";
	var negDoiLabelWidth = "-" + doiLabelWidth;
	var submitButtonWidth = $("#resolveSubmit").outerWidth() + "px";
	var negSubmitButtonWidth = "-" + submitButtonWidth;

	$("#mainForm").css("padding-left", doiLabelWidth);
	$("#mainForm").css("padding-right", submitButtonWidth);
	$("#formDoiLabel").css("width", doiLabelWidth);
	$("#formDoiLabel").css("right", "0");
	$("#formDoiLabel").css("margin-left", negDoiLabelWidth);
	$("#submitButtonContainer").css("width", submitButtonWidth);
	$("#submitButtonContainer").css("margin-right", negSubmitButtonWidth);

	var textInputWidth = ($("#doiForm").outerWidth() - $("#formDoiLabel").outerWidth() - $("#resolveSubmit").outerWidth()) + "px";
	$("#textInputContainer").css("width", textInputWidth);
}

// Remove spaces and punctuation from beginning and end of input
function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

// Check that DOI is valid and warn user if not (in bubble)
function checkValidDoi(doiInput) {
	if(doiInput.match(/^10\./)) {
		return true;
	} else if(doiInput.match(/^10\//)) {
		return true;
	} else {
		bubbleMessage(chrome.i18n.getMessage("invalidDoiAlert"));
		return false;
	}
}

// Clear message space in bubble and reset height
function resetMessageSpace() {
	$("#messageDiv").empty();
	$("#messageDiv").css("display", "none");
	resetBubbleHeight();
}

// General messaging area in bubble
function bubbleMessage(message) {
	resetMessageSpace();

	$("#messageDiv").css("display", "block");
	$("#messageDiv").css("height", "60px");
	$("<div>").html(message).appendTo($("#messageDiv"));
}

// Process the form
function formSubmitHandler() {
	var actionType = $("#hiddenButtonInput").val();
	var doiInput = escape(trim($("#textInput").val()));

	switch(actionType) {
	case "qr":
		qrGen(doiInput);
		break;
	case "cite":
		citeDOI(doiInput);
		break;
	case "doi":
		if(doiInput.length == 0 || !checkValidDoi(doiInput)) return;
		chrome.tabs.create({url:resolveURL(doiInput)});
		window.close();
		break;
	default:
		break;
	}
}

// Build URL based on custom resolver settings
function resolveURL(doi) {
	var cr = localStorage["custom_resolver"];
	var cra = localStorage["cr_always"];
	var crl = localStorage["cr_last"];
	var dr = localStorage["doi_resolver"];
	var sr = localStorage["shortdoi_resolver"];
	var useDefaultResolver = true;

	if(cr == "true" && cra == 'always') {
		useDefaultResolver = false;
	} else if (cr == "true" && cra == 'optional' && crl == 'custom') {
		useDefaultResolver = false;
	}

	if(useDefaultResolver) {
		if(doi.match(/^10\./)) return "http://dx.doi.org/" + doi;
		else if(doi.match(/^10\//)) return "http://doi.org/" + doi.replace(/^10\//,"");	
	} else {
		if(doi.match(/^10\./)) return dr + doi;
		else if(doi.match(/^10\//)) return sr + doi.replace(/^10\//,"");
	}

	return "";
}

// Open citation formatting page
function citeDOI(doiInput) {
	var citeUrl= "citation.html?doi=" + doiInput;
	chrome.tabs.create({url:citeUrl});
	window.close();
}

// Open QR generator page
function qrGen(doiInput) {
	var qrUrl = "qr.html?doi=" + doiInput;
	chrome.tabs.create({url:qrUrl});
	window.close();
}

// Show or hide additional buttons in bubble
function showHideOptionalElms() {
	var meta = localStorage["meta_buttons"];
	var craOp = localStorage["cr_always"];

	if(meta == "true") {
		$("#metaButtons").css("display", "block");
	} else {
		$("#metaButtons").css("display", "none");
	}

	if(craOp == 'optional') {
		$("#crRadios").css("display", "block");
	} else {
		$("#crRadios").css("display", "none");
	}
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("resolveSubmit");
	$("#resolveSubmit").attr("value", message);
	message = chrome.i18n.getMessage("citeSubmit");
	$("#citeSubmit").attr("value", message);
	message = chrome.i18n.getMessage("optionCrRadioBubble");
	$("#optionCrRadioBubble").html(message);
	message = chrome.i18n.getMessage("optionCrRadioBubbleCustom");
	$("#optionCrRadioBubbleCustom").html(message);
	message = chrome.i18n.getMessage("optionCrRadioBubbleDefault");
	$("#optionCrRadioBubbleDefault").html(message);
}

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
	getLocalMessages();
	showHideMetaButtons();
	setTextBoxWidth();
	startListeners();
}, false);

function startListeners() {
	jQuery("#resolveSubmit").click(function() {
		jQuery("#hiddenButtonInput").val("doi");
	});
	jQuery("#citeSubmit").click(function() {
		jQuery("#hiddenButtonInput").val("cite");
	});
	jQuery("#qrSubmit").click(function() {
		jQuery("#hiddenButtonInput").val("qr");
	});
	jQuery('#doiForm').submit(function () {
		formSubmitHandler();
		return false;
	});
}

// Dynamically adjust bubble height when content changes
function resetBubbleHeight() {
	var bubbleHeight = document.getElementById("containerDiv").offsetHeight;
	document.body.style.height = (bubbleHeight + "px").toString();
}

// Set text box width to fill all space between label and button
function setTextBoxWidth() {
	// Read: http://www.alistapart.com/articles/holygrail
	// DOI label doesn't align right when following guide exactly

	var doiLabelWidth = (document.getElementById("formDoiLabel").offsetWidth + "px").toString();
	var negDoiLabelWidth = ("-" + document.getElementById("formDoiLabel").offsetWidth + "px").toString();
	var submitButtonWidth = (document.getElementById("resolveSubmit").offsetWidth + "px").toString();
	var negSubmitButtonWidth = ("-" + document.getElementById("resolveSubmit").offsetWidth + "px").toString();

	document.getElementById("mainForm").style.paddingLeft = doiLabelWidth;
	document.getElementById("mainForm").style.paddingRight = submitButtonWidth;
	document.getElementById("formDoiLabel").style.width = doiLabelWidth;
	document.getElementById("formDoiLabel").style.right = "0";
	document.getElementById("formDoiLabel").style.marginLeft = negDoiLabelWidth;
	document.getElementById("submitButtonContainer").style.width = submitButtonWidth;
	document.getElementById("submitButtonContainer").style.marginRight = negSubmitButtonWidth;
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
	var messageElement = document.getElementById("messageDiv");

	while (messageElement.firstChild) messageElement.removeChild(messageElement.firstChild);
	messageElement.style.display = "none";
	resetBubbleHeight();
}

// General messaging area in bubble
function bubbleMessage(message) {
	resetMessageSpace();

	var messageElement = document.getElementById("messageDiv");
	messageElement.style.display = "block";
	messageElement.style.height = "60px";
	messageElement.innerHTML = "<div style=\"line-height:60px\">" + message + "</div>";
}

// Process the form
function formSubmitHandler() {
	var actionType = jQuery("#hiddenButtonInput").val();
	var doiInput = escape(trim(jQuery('#textInput').val()));

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
	var dr = localStorage["doi_resolver"];
	var sr = localStorage["shortdoi_resolver"];

	if(doi.match(/^10\./) && cr == "true") return dr + doi;
	else if(doi.match(/^10\./) && cr != "true") return "http://dx.doi.org/" + doi;
	else if(doi.match(/^10\//) && cr == "true") return sr + doi.replace(/^10\//,"");
	else if(doi.match(/^10\//) && cr != "true") return "http://doi.org/" + doi.replace(/^10\//,"");

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
function showHideMetaButtons() {
	var meta = localStorage["meta_buttons"];

	if(meta == "true") {
		document.getElementById("metaButtons").style.display="block";
	} else {
		document.getElementById("metaButtons").style.display="none";
	}
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("resolveSubmit");
	document.getElementById("resolveSubmit").setAttribute("value",message);
	message = chrome.i18n.getMessage("citeSubmit");
	document.getElementById("citeSubmit").setAttribute("value",message);
}

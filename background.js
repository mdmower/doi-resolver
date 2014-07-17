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
	checkForSettings();
	startFeatures();
}, false);

// Set default options and rename old option names
function setDefaultOption(opt) {
	switch(opt) {
	case 'cm':
		if(typeof localStorage["doi_context_enable"] != 'undefined') {
			localStorage["context_menu"] = localStorage["doi_context_enable"];
			localStorage.removeItem("doi_context_enable");
		} else {
		localStorage["context_menu"] = true;
		}
		break;
	case 'meta':
		if(typeof localStorage["doi_metabuttons_enable"] != 'undefined') {
			localStorage["meta_buttons"] = localStorage["doi_metabuttons_enable"];
			localStorage.removeItem("doi_metabuttons_enable");
		} else {
		localStorage["meta_buttons"] = true;
		}
		break;
	case 'cr':
		localStorage["custom_resolver"] = false;
		break;
	case 'cra':
		localStorage["cr_always"] = "always";
		break;
	case 'crl':
		localStorage["cr_last"] = "custom";
		break;
	case 'dr':
		localStorage["doi_resolver"] = "http://dx.doi.org/";
		break;
	case 'sr':
		localStorage["shortdoi_resolver"] = "http://doi.org/";
		break;
	case 'al':
		if(typeof localStorage["autoLink_permission"] != 'undefined') {
			localStorage["auto_link"] = localStorage["autoLink_permission"];
			localStorage.removeItem("autoLink_permission");
		} else {
		localStorage["auto_link"] = false;
		}
		break;
	case 'qrTitle':
		if(typeof localStorage["crossref_permission"] != 'undefined') {
			localStorage.removeItem("crossref_permission");
		}
		localStorage["qr_title"] = false;
		break;
	case 'cs':
		localStorage["cite_style"] = "bibtex";
		break;
	case 'cl':
		localStorage["cite_locale"] = "en-US";
		break;
	default:
		break;
	}
}

function checkForSettings() {
	// Set on options page
	if(typeof localStorage["context_menu"] == 'undefined') setDefaultOption('cm');
	if(typeof localStorage["meta_buttons"] == 'undefined') setDefaultOption('meta');
	if(typeof localStorage["custom_resolver"] == 'undefined') setDefaultOption('cr');
	if(typeof localStorage["cr_always"] == 'undefined') setDefaultOption('cra');
	if(typeof localStorage["cr_last"] == 'undefined') setDefaultOption('crl');
	if(typeof localStorage["doi_resolver"] == 'undefined') setDefaultOption('dr');
	if(typeof localStorage["shortdoi_resolver"] == 'undefined') setDefaultOption('sr');
	if(typeof localStorage["auto_link"] == 'undefined') setDefaultOption('al');

	// Set elsewhere
	if(typeof localStorage["qr_title"] == 'undefined') setDefaultOption('qrTitle');
	if(typeof localStorage["cite_style"] == 'undefined') setDefaultOption('cs');
	if(typeof localStorage["cite_locale"] == 'undefined') setDefaultOption('cl');
}

function startFeatures() {
	if(localStorage["context_menu"] == "true") contextMenuMaker();
	if(localStorage["auto_link"] == "true") autoLinkDOIs();
}

// Remove spaces and punctuation from beginning and end of input
function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

// Check that DOI is valid and warn user if not (alert)
function checkValidDoi(doiInput) {
	if(doiInput.match(/^10\./)) {
		return true;
	} else if(doiInput.match(/^10\//)) {
		return true;
	} else {
		alert(chrome.i18n.getMessage("invalidDoiAlert"));
		return false;
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

// Context menu
function contextMenuMaker() {
	chrome.contextMenus.create({
		"title" : chrome.i18n.getMessage("contextText"),
		"type" : "normal",
		"contexts" : ["selection"],
		"onclick" : cmResolve
	});
}

// Context menu resolve doi
function cmResolve(info) {
	var doiInput = escape(trim(info.selectionText));
	if(checkValidDoi(doiInput)) chrome.tabs.create({url:resolveURL(doiInput)});
}

// Context menu request handler
chrome.extension.onRequest.addListener(function(request) {
	switch(request.cmd) {
	case "enable_context":
		contextSetting = "true";
		chrome.contextMenus.removeAll();
		contextMenuMaker();
		break;
	case "disable_context":
		contextSetting = "false";
		chrome.contextMenus.removeAll();
		break;
	default:
		break;
	}
});

// Auto-link listeners
function autoLinkDOIs() {
	chrome.tabs.onUpdated.addListener(function(tab) {
		chrome.tabs.executeScript(tab.id, {file: "autolink.js"});
	});
	chrome.tabs.onCreated.addListener(function(tab) {
		chrome.tabs.executeScript(tab.id, {file: "autolink.js"});
	});
}

// Auto-link message passing
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.cmd == "resolve_url") {
		var urlPrefix = "http://dx.doi.org/";
		if(localStorage["custom_resolver"] == "true") urlPrefix = localStorage["doi_resolver"];
		sendResponse({cmd: urlPrefix});
	}
});

// Omnibox
chrome.omnibox.onInputEntered.addListener( function (text) {
	console.log('inputEntered: ' + text);
	var doiInput = escape(trim(text));
	chrome.tabs.create({url:resolveURL(doiInput)});
});

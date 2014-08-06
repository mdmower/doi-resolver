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
		localStorage["context_menu"] = true;
		break;
	case 'meta':
		localStorage["meta_buttons"] = true;
		break;
	case 'cr':
		localStorage["custom_resolver"] = false;
		break;
	case 'cra':
		localStorage["cr_autolink"] = "custom";
		break;
	case 'crb':
		localStorage["cr_bubble"] = "custom";
		localStorage["cr_bubble_last"] = "custom";
		break;
	case 'crc':
		localStorage["cr_context"] = "custom";
		break;
	case 'cro':
		localStorage["cr_omnibox"] = "custom";
		break;
	case 'dr':
		localStorage["doi_resolver"] = "http://dx.doi.org/";
		break;
	case 'sr':
		localStorage["shortdoi_resolver"] = "http://doi.org/";
		break;
	case 'ot':
		localStorage["omnibox_tab"] = "newfgtab";
		break;
	case 'al':
		localStorage["auto_link"] = false;
		break;
	case 'alp':
		localStorage["al_protocol"] = "http";
		break;
	case 'qrTitle':
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
	if(typeof localStorage["cr_autolink"] == 'undefined') setDefaultOption('cra');
	if(typeof localStorage["cr_bubble"] == 'undefined') setDefaultOption('crb');
	if(typeof localStorage["cr_context"] == 'undefined') setDefaultOption('crc');
	if(typeof localStorage["cr_omnibox"] == 'undefined') setDefaultOption('cro');
	if(typeof localStorage["doi_resolver"] == 'undefined') setDefaultOption('dr');
	if(typeof localStorage["shortdoi_resolver"] == 'undefined') setDefaultOption('sr');
	if(typeof localStorage["omnibox_tab"] == 'undefined') setDefaultOption('ot');
	if(typeof localStorage["auto_link"] == 'undefined') setDefaultOption('al');
	if(typeof localStorage["al_protocol"] == 'undefined') setDefaultOption('alp');

	// Set elsewhere
	if(typeof localStorage["qr_title"] == 'undefined') setDefaultOption('qrTitle');
	if(typeof localStorage["cite_style"] == 'undefined') setDefaultOption('cs');
	if(typeof localStorage["cite_locale"] == 'undefined') setDefaultOption('cl');
	if(typeof localStorage["cr_bubble_last"] == 'undefined') setDefaultOption('crb');
}

function startFeatures() {
	if(localStorage["context_menu"] == "true") {
		contextMenuMaker();
	}
	if(localStorage["auto_link"] == "true") {
		autoLinkDOIs();
	}
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
function resolveURL(doi, source) {
	var cr = localStorage["custom_resolver"];
	var crc = localStorage["cr_context"];
	var cro = localStorage["cr_omnibox"];
	var dr = localStorage["doi_resolver"];
	var sr = localStorage["shortdoi_resolver"];
	var useDefaultResolver = true;

	switch(source) {
		case "context":
			if(cr == "true" && crc == "custom") {
				useDefaultResolver = false;
			}
			break;
		case "omnibox":
			if(cr == "true" && cro == "custom") {
				useDefaultResolver = false;
			}
			break;
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
	if(checkValidDoi(doiInput)) {
		chrome.tabs.create({url:resolveURL(doiInput, "context")});
	}
}

// Message passing
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch(request.cmd) {
		case "context_menu":
			if(request.setting == "enable") {
				chrome.contextMenus.removeAll();
				contextMenuMaker();
			} else {
				chrome.contextMenus.removeAll();
			}
			break;
		case "auto_link":
			autoLinkDOIs();
			break;
		case "al_resolve_url":
			var cr = localStorage["custom_resolver"];
			var cra = localStorage["cr_autolink"];
			var urlPrefix = "http://dx.doi.org/";
			if(cr == "true" && cra == "custom") {
				urlPrefix = localStorage["doi_resolver"];
			}
			sendResponse({url: urlPrefix});
			break;
		default:
			break;
	}
});

// Auto-link listeners
function alListener(tab) {
	chrome.tabs.executeScript(tab.id, {file: "autolink.js"});
}

function autoLinkDOIs() {
	chrome.tabs.onUpdated.removeListener(alListener);
	chrome.tabs.onCreated.removeListener(alListener);

	chrome.permissions.contains({
		permissions: [ 'tabs' ],
		origins: [ 'http://*/*', 'https://*/*' ]
	}, function(result) {
		if(result) {
			localStorage["auto_link"] = true;
			localStorage["al_protocol"] = "httphttps";
			chrome.tabs.onUpdated.addListener(alListener);
			chrome.tabs.onCreated.addListener(alListener);
			console.log('autolink listeners enabled for http and https');
		} else {
			chrome.permissions.contains({
				permissions: [ 'tabs' ],
				origins: [ 'http://*/*' ]
			}, function(result) {
				if(result) {
					localStorage["auto_link"] = true;
					localStorage["al_protocol"] = "http";
					chrome.tabs.onUpdated.addListener(alListener);
					chrome.tabs.onCreated.addListener(alListener);
					console.log('autolink listeners enabled for http');
				} else {
					chrome.permissions.contains({
						permissions: [ 'tabs' ],
						origins: [ 'https://*/*' ]
					}, function(result) {
						if(result) {
							localStorage["auto_link"] = true;
							localStorage["al_protocol"] = "https";
							chrome.tabs.onUpdated.addListener(alListener);
							chrome.tabs.onCreated.addListener(alListener);
							console.log('autolink listeners enabled for https');
						} else {
							localStorage["auto_link"] = false;
							console.log('autolink listeners disabled');
						}
					});
				}
			});
		}
	});
}

// Omnibox
function navigate(url) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.update(tabs[0].id, {url: url});
	});
}

chrome.omnibox.onInputEntered.addListener( function (text, disposition) {
	console.log('inputEntered: ' + text);
	var doiInput = escape(trim(text));
	var ot = localStorage["omnibox_tab"];
	var tabToUse;

	if (disposition == "currentTab" && ot == "newfgtab") {
		tabToUse = "newForegroundTab";
	} else if (disposition == "currentTab" && ot == "newbgtab") {
		tabToUse = "newBackgroundTab";
	} else {
		tabToUse = disposition;
	}

	if (tabToUse == "newForegroundTab") {
		chrome.tabs.create({url:resolveURL(doiInput, "omnibox")});
	} else if (tabToUse == "newBackgroundTab") {
		chrome.tabs.create({active: false, url:resolveURL(doiInput, "omnibox")});
	} else {
		navigate(resolveURL(doiInput, "omnibox"));
	}
});

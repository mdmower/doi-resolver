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
	cleanupPerms();
	checkForSettings();
	fetchOptions({cl: false, fr: true, csr: false});
	permRemoveListeners();
}, false);

function getDefaultOption(opt) {
	defaultOptions = {
		al_protocol: "http",
		auto_link: false,
		cite_locale: "auto",
		cite_style: "bibtex",
		context_menu: true,
		cr_autolink: "custom",
		cr_bubble: "custom",
		cr_bubble_last: "custom",
		cr_context: "custom",
		cr_omnibox: "custom",
		custom_resolver: false,
		doi_resolver: "http://dx.doi.org/",
		meta_buttons: true,
		omnibox_tab: "newfgtab",
		qr_bgcolor: "#ffffff",
		qr_bgtrans: false,
		qr_fgcolor: "#000000",
		qr_size: "300",
		qr_title: false,
		shortdoi_resolver: "http://doi.org/",
		sync_data: false,
		sync_reset: false
	}

	if(typeof defaultOptions[opt] !== 'undefined')
		return defaultOptions[opt];

	return false;
}

function checkForSettings() {
	options = [
		"al_protocol",
		"auto_link",
		"cite_locale",
		"cite_style",
		"context_menu",
		"cr_autolink",
		"cr_bubble",
		"cr_bubble_last",
		"cr_context",
		"cr_omnibox",
		"custom_resolver",
		"doi_resolver",
		"meta_buttons",
		"omnibox_tab",
		"qr_bgcolor",
		"qr_bgtrans",
		"qr_fgcolor",
		"qr_size",
		"qr_title",
		"shortdoi_resolver",
		"sync_data",
		"sync_reset"
	];

	for(var i = 0; i < options.length; i++) {
		if(typeof localStorage[options[i]] === 'undefined')
			localStorage[options[i]] = getDefaultOption(options[i]);
	}

	syncOptions();
}

/*
 * Fetch parameters:
 * cl: Cycle Listeners (for options page)
 * fr: First Run (i.e. this is the first run-through of background page)
 * csr: Clear Sync Reset
 */
function fetchOptions(params) {
	syncListener(false);
	if(localStorage["sync_data"] != "true") {
		if(params.fr) {
			startFeatures();
		}
		chrome.runtime.sendMessage({cmd: "fetch_complete", cl: params.cl});
		return;
	}

	var syncOpts = ["context_menu", "meta_buttons", "cr_autolink", "cr_bubble",
		"cr_context", "cr_omnibox", "doi_resolver", "shortdoi_resolver",
		"omnibox_tab", "al_protocol", "qr_size", "qr_fgcolor", "qr_bgcolor",
		"qr_bgtrans", "cite_style", "cite_locale", "cr_bubble_last",
		"custom_resolver", "sync_reset"];

	var settingsBundle = {};
	for(var i = 0; i < syncOpts.length; i++) {
		settingsBundle[syncOpts[i]] = localStorage[syncOpts[i]];
	};

	chrome.storage.sync.get(settingsBundle, function(result) {
		if(result["sync_reset"] == "true" && params.csr != true) {
			localStorage["sync_data"] = false;
		} else if(params.csr) {
			for(var i = 0; i < syncOpts.length; i++) {
				localStorage[syncOpts[i]] = result[syncOpts[i]];
			};
			localStorage["sync_reset"] = false;
			chrome.storage.sync.set({sync_reset: false}, function() {
				if(typeof chrome.runtime.lastError != 'undefined') {
					console.log(chrome.runtime.lastError);
				}
			});
		} else {
			for(var i = 0; i < syncOpts.length; i++) {
				localStorage[syncOpts[i]] = result[syncOpts[i]];
			};
		}
		if(params.fr) {
			startFeatures();
		}
		if(localStorage["sync_data"] == "true") {
			syncListener(true);
		}
		chrome.runtime.sendMessage({cmd: "fetch_complete", cl: params.cl});
	});
}

function syncOptions() {
	if(localStorage["sync_data"] != "true") {
		return;
	}

	if(localStorage["sync_reset"] == "true") {
		localStorage["sync_data"] = false;
		chrome.storage.sync.clear(function() {
			if(typeof chrome.runtime.lastError != 'undefined') {
				console.log(chrome.runtime.lastError);
			}
			chrome.storage.sync.set({sync_reset: "true"}, function() {
				if(typeof chrome.runtime.lastError != 'undefined') {
					console.log(chrome.runtime.lastError);
				}
			});
		});
	} else {
		// Blacklist: sync_data, auto_link, qr_title
		var syncOpts = ["context_menu", "meta_buttons", "cr_autolink", "cr_bubble",
			"cr_context", "cr_omnibox", "doi_resolver", "shortdoi_resolver",
			"omnibox_tab", "al_protocol", "qr_size", "qr_fgcolor", "qr_bgcolor",
			"qr_bgtrans", "cite_style", "cite_locale", "cr_bubble_last",
			"custom_resolver"];

		var settingsBundle = {};
		for(var i = 0; i < syncOpts.length; i++) {
			settingsBundle[syncOpts[i]] = localStorage[syncOpts[i]];
		};

		chrome.storage.sync.set(settingsBundle, function() {
			if(typeof chrome.runtime.lastError != 'undefined') {
				console.log(chrome.runtime.lastError);
			}
		});
	}
}

/*
 * Detect upstream changes when they occur and apply them here immediately.
 * The Sync listener should start after the first run through of fetchOptions,
 * but it should also start if the user toggles Sync on-off-on. Remove and
 * re-add the listener each time fetchOptions is called. This has the added
 * benefit of ensuring the listener is disabled if sync is disabled.
 */
function syncListener(enable) {
	if(enable) {
		chrome.storage.onChanged.addListener(syncChangeHandler);
	} else {
		chrome.storage.onChanged.removeListener(syncChangeHandler);
	}
}

function syncChangeHandler(changes, namespace) {
	if(namespace != "sync") {
		return;
	}

	var opt;
	var goFetch = false;

	for(opt in changes) {
		var newVal = changes[opt].newValue;
		if(opt == "sync_reset") {
			if(newVal == "true") {
				console.log("[Sync] reset detected, disabling sync");
				localStorage["sync_reset"] = true;
				localStorage["sync_data"] = false;
			} else if(newVal == "false") { // sync_reset can be undefined, so check for "false"
				console.log("[Sync] service reactivated");
				localStorage["sync_reset"] = false;
			}
			goFetch = true;
		} else if(newVal != localStorage[opt]) {
			goFetch = true;
		}
	}

	if(goFetch) {
		console.log("[Sync] changes detected, syncing");
		fetchOptions({cl: true, fr: false, csr: false});
	}
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
		case "sync_opts":
			syncOptions();
			break;
		case "sync_listener":
			syncListener(request.enable);
			sendResponse({status: "finished"});
			break;
		case "fetch_opts":
			fetchOptions({cl: request.cl, fr: false, csr: request.csr});
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
		case "record_tab_id":
			tabRecord(request.id, true);
			break;
		default:
			break;
	}
});

function cleanupPerms() {
	chrome.permissions.remove({
		origins: [
			'http://*.doi.org/',
			'http://*.crossref.org/',
			'http://*.datacite.org/',
			'https://raw.githubusercontent.com/'
		]
	}, function(removed) {
		if(removed)
			console.log("Permissions cleaned");
		else
			console.log("Unable to cleanup permissions");
	});
}

function tabRecord(id, add) {
	if(typeof tabRecord.openTabs == 'undefined')
		tabRecord.openTabs = [];

	if(add) {
		tabRecord.openTabs.push(id);
	} else {
		var index = tabRecord.openTabs.indexOf(id);
		tabRecord.openTabs.splice(index, 1);
	}
}

function permRemoveListeners() {
	chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
		if(typeof tabRecord.openTabs != 'undefined' && tabRecord.openTabs.indexOf(tabId) >= 0) {
			chrome.permissions.remove({
				origins: [
					'http://*.doi.org/',
					'http://*.crossref.org/',
					'http://*.datacite.org/',
					'https://raw.githubusercontent.com/'
				]
			}, function(removed) {
				if(removed)
					console.log("Removed qr/citation-related permissions");
				else
					console.log("Unable to remove qr/citation-related permissions");
			});
			tabRecord(tabId, false);
		}
	});
}

// Auto-link listeners
function alListener(tabId, changeInfo, tab) {
	chrome.permissions.contains({
		origins: [ 'http://*/*', 'https://*/*' ]
	}, function(result) {
		if(result && tab.url.indexOf("http") == 0) {
			chrome.tabs.executeScript(tabId, {file: "autolink.js"});
		} else {
			chrome.permissions.contains({
				origins: [ 'http://*/*' ]
			}, function(result) {
				if(result && tab.url.indexOf("http") == 0 && tab.url.indexOf("https") == -1) {
					chrome.tabs.executeScript(tabId, {file: "autolink.js"});
				} else {
					chrome.permissions.contains({
						origins: [ 'https://*/*' ]
					}, function(result) {
						if(result && tab.url.indexOf("https") == 0) {
							chrome.tabs.executeScript(tabId, {file: "autolink.js"});
						}
					});
				}
			});
		}
	});
}

function autoLinkDOIs() {
	chrome.tabs.onUpdated.removeListener(alListener);

	chrome.permissions.contains({
		permissions: [ 'tabs' ],
		origins: [ 'http://*/*', 'https://*/*' ]
	}, function(result) {
		if(result) {
			localStorage["auto_link"] = true;
			localStorage["al_protocol"] = "httphttps";
			syncOptions();
			chrome.tabs.onUpdated.addListener(alListener);
			console.log('Autolink listeners enabled for http and https');
		} else {
			chrome.permissions.contains({
				permissions: [ 'tabs' ],
				origins: [ 'http://*/*' ]
			}, function(result) {
				if(result) {
					localStorage["auto_link"] = true;
					localStorage["al_protocol"] = "http";
					syncOptions();
					chrome.tabs.onUpdated.addListener(alListener);
					console.log('Autolink listeners enabled for http');
				} else {
					chrome.permissions.contains({
						permissions: [ 'tabs' ],
						origins: [ 'https://*/*' ]
					}, function(result) {
						if(result) {
							localStorage["auto_link"] = true;
							localStorage["al_protocol"] = "https";
							syncOptions();
							chrome.tabs.onUpdated.addListener(alListener);
							console.log('Autolink listeners enabled for https');
						} else {
							localStorage["auto_link"] = false;
							console.log('Autolink listeners disabled');
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

	if(disposition == "currentTab" && ot == "newfgtab") {
		tabToUse = "newForegroundTab";
	} else if(disposition == "currentTab" && ot == "newbgtab") {
		tabToUse = "newBackgroundTab";
	} else {
		tabToUse = disposition;
	}

	if(tabToUse == "newForegroundTab") {
		chrome.tabs.create({url:resolveURL(doiInput, "omnibox")});
	} else if(tabToUse == "newBackgroundTab") {
		chrome.tabs.create({active: false, url:resolveURL(doiInput, "omnibox")});
	} else {
		navigate(resolveURL(doiInput, "omnibox"));
	}
});

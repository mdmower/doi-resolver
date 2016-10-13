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

function storage(firstRun) {
	if (typeof storage.area === 'undefined') {
		storage.area = chrome.storage.local;
	}

	if (firstRun === true && localStorage.length > 0) {
		migrateStorage(continueOnLoad);
	} else {
		chrome.storage.local.get(["sync_data"], function(stg) {
			if (stg["sync_data"] === true) {
				storage.area = chrome.storage.sync;
			} else {
				storage.area = chrome.storage.local;
			}

			if (firstRun === true) {
				continueOnLoad();
			}
		});
	}
}

function migrateStorage(callback) {
	var key;
	var options = allOptions();

	var optionPairs = {};
	for (var i = 0; i < options.length; i++) {
		key = options[i];
		if (typeof localStorage[key] !== 'undefined') {
			if (key === "sync_reset") {
				// .sync storage only
			} else if (localStorage[key] === 'true') {
				optionPairs[key] = true;
			} else if (localStorage[key] === 'false') {
				optionPairs[key] = false;
			} else {
				optionPairs[key] = localStorage[key];
			}
		}
	}

	chrome.storage.local.set(optionPairs, function() {
		console.log("localStorage migrated to chrome.storage.local");
		localStorage.clear();

		chrome.storage.sync.get(null, function(stgSync) {
			var optionSyncPairs = {};
			for (key in stgSync) {
				if (stgSync.hasOwnProperty(key)) {
					if (stgSync[key] === 'true') {
						optionSyncPairs[key] = true;
					} else if (stgSync[key] === 'false') {
						optionSyncPairs[key] = false;
					}
				}
			}
			chrome.storage.sync.set(optionSyncPairs, function() {
				if (optionPairs["sync_data"] === true) {
					storage.area = chrome.storage.sync;
				}
				callback();
			});
		});
	});
}

function continueOnLoad() {
	chrome.storage.onChanged.addListener(storageChangeHandler);
	chrome.omnibox.onInputEntered.addListener(omniListener);
	storageListener(true);
	cleanupPerms();
	checkForSettings(startFeatures);
	permRemoveListeners();
}

function allOptions() {
	return [
		"al_protocol",
		"auto_link",
		"auto_link_rewrite",
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
		"history",
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
}

function excludeFromSync() {
	return [
		"al_protocol", // Requires user interaction to trigger permissions requests
		"auto_link",   // Requires permissions to enable
		"qr_title",    // Requires permissions to enable
		"sync_data"    // Controls sync on/off
	];
}

Array.prototype.diff = function(a) {
	return this.filter(function(i) {
		return a.indexOf(i) < 0;
	});
};

function getDefaultOption(opt) {
	var defaultOptions = {
		al_protocol: "http",
		auto_link: false,
		auto_link_rewrite: false,
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
		history: false,
		meta_buttons: true,
		omnibox_tab: "newfgtab",
		qr_bgcolor: "#ffffff",
		qr_bgtrans: false,
		qr_fgcolor: "#000000",
		qr_size: "300",
		qr_title: false,
		shortdoi_resolver: "http://doi.org/",
		sync_data: false
	};
	/* sync_reset is not stored locally
	 * and does not need a default set */

	if (typeof defaultOptions[opt] !== 'undefined') {
		return defaultOptions[opt];
	}

	return; // returns 'undefined'
}

function checkForSettings(callback) {
	var key;
	var options = (allOptions()).diff(["sync_reset"]);
	var newOptions = {};
	var updateSettings = false;

	chrome.storage.local.get(options, function(stg) {
		for (var i = 0; i < options.length; i++) {
			key = options[i];
			if (typeof stg[key] === 'undefined') {
				newOptions[key] = getDefaultOption(key);
				updateSettings = true;
			}
		}

		if (updateSettings) {
			chrome.storage.local.set(newOptions, callback);
		} else {
			callback();
		}
	});
}

/*
 * toggleSync expects sync_data and sync_reset are set in .local and .sync
 * storage, respectively, before being called.
 */
function toggleSync() {
	var key;
	var syncKeys = (allOptions()).diff(excludeFromSync());
	var dupOptions = {};

	chrome.storage.local.get(null, function(stgLocal) {
	chrome.storage.sync.get(null, function(stgSync) {
		var syncEnabled = (typeof stgLocal["sync_data"] === "boolean") ? stgLocal["sync_data"] : true;
		var syncReset = (typeof stgSync["sync_reset"] === "boolean") ? stgSync["sync_reset"] : false;

		if (syncEnabled && !syncReset) {
			console.log("[Sync] Using sync storage");
			for (var i = 0; i < syncKeys.length; i++) {
				key = syncKeys[i];
				if (typeof stgSync[key] === 'undefined') {
					if (typeof stgLocal[key] === 'undefined') {
						dupOptions[key] = getDefaultOption(key);
					} else {
						dupOptions[key] = stgLocal[key];
					}
				}
			}
			chrome.storage.sync.set(dupOptions, function() {
				storage.area = chrome.storage.sync;
				chrome.runtime.sendMessage({cmd: "sync_toggle_complete"});
				storageListener(true);
			});
		} else if (!syncEnabled && !syncReset) {
			console.log("[Sync] Using local storage");
			storage.area = chrome.storage.local;
			chrome.runtime.sendMessage({cmd: "sync_toggle_complete"});
			storageListener(true);
		} else if (syncReset) {
			console.log("[Sync] Reset detected, wiping sync storage");
			storage.area = chrome.storage.local;
			chrome.storage.sync.clear(function() {
				chrome.storage.sync.set({sync_reset: true}, function() {
					chrome.runtime.sendMessage({cmd: "sync_toggle_complete"});
					storageListener(true);
				});
			});
		}
	});
	});
}

function storageListener(enable) {
	if (typeof storageListener.status === 'undefined') {
		storageListener.status = true;
	}

	if (enable) {
		storageListener.status = true;
	} else {
		storageListener.status = false;
	}
}

function storageChangeHandler(changes, namespace) {
	if (storageListener.status !== true) {
		return;
	}

	/* Debugging */
	/*
	for (var key in changes) {
		if (changes.hasOwnProperty(key)) {
			console.log("Option: " + key + ", oldValue: " + changes[key].oldValue + ", newValue: " + changes[key].newValue + ", Namespace: " + namespace);
		}
	}
	*/

	if (namespace === "local") {
		chrome.storage.local.get(["sync_data"], function(stgLocal) {
			if (stgLocal["sync_data"] === true) {
				var toSync = {};
				var syncKeys = (allOptions()).diff(excludeFromSync());
				for (var key in changes) {
					if (changes.hasOwnProperty(key)) {
						if (syncKeys.indexOf(key) >= 0) {
							toSync[key] = changes[key].newValue;
						}
					}
				}
				storageListener(false);
				/* We need to send a message to the options page even if toSync is
				 * empty, so go ahead and .set() regardless of content. This
				 * covers auto_link so that storage listeners on the Options page
				 * can resume while permissions verification occurs asynchronously.
				 */
				chrome.storage.sync.set(toSync, function() {
					storageListener(true);
					if (typeof changes["context_menu"] !== 'undefined') {
						toggleContextMenu();
					}
					chrome.runtime.sendMessage({cmd: "settings_dup_complete"});
				});
			} else {
				if (typeof changes["context_menu"] !== 'undefined') {
					toggleContextMenu();
				}
				chrome.runtime.sendMessage({cmd: "settings_dup_complete"});
			}
		});
	} else if (namespace === "sync") {
		/*
		 * If user reset sync before storage migration,
		 * the value is stored as a string, not a bool
		 */
		if (typeof changes["sync_reset"] !== 'undefined') {
			var sr = changes["sync_reset"].newValue;
			if (sr === true || sr === "true") {
				storageListener(false);
				chrome.storage.local.set({sync_data: false}, toggleSync);
				return; // No need to perform anything below since wiping
			}
		} else if (typeof changes["context_menu"] !== 'undefined') {
			toggleContextMenu();
		}

		/* optionSyncPairs is for sanitizing bools coming from
		 * pre-storage-migration and pushing back to .sync.
		 *
		 * optionLocalPairs is for keeping .local in-sync with
		 * .sync since toggleSync only switches between storage
		 * areas when sync disabled; it does not copy values.
		 */
		var optionSyncPairs = {};
		var optionLocalPairs = {};
		for (var key in changes) {
			if (changes.hasOwnProperty(key)) {
				if (changes[key].newValue === 'true') {
					optionSyncPairs[key] = true;
					optionLocalPairs[key] = true;
				} else if (changes[key].newValue === 'false') {
					optionSyncPairs[key] = false;
					optionLocalPairs[key] = false;
				} else if (key !== 'al_protocol') {
					/* Migration: al_protocol was removed from sync
					 * since calls to chrome.permissions.request must
					 * stem from user interaction; thus, autolink
					 * listeners cannot be refreshed. Ignore since old
					 * versions of this extension may still alter it.
					 */
					optionLocalPairs[key] = changes[key].newValue;
				}
			}
		}

		storageListener(false);
		chrome.storage.sync.set(optionSyncPairs, function() {
		chrome.storage.local.set(optionLocalPairs, function() {
			storageListener(true);
		});
		});
	}
}

function startFeatures() {
	storage.area.get(["context_menu"], function(stg) {
		if (stg["context_menu"] === true) {
			contextMenuMaker();
		}
	});
	chrome.storage.local.get(["auto_link"], function(stg) {
		if (stg["auto_link"] === true) {
			autoLinkDOIs();
		}
	});
}

// Remove spaces and punctuation from beginning and end of input
function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

// Check that DOI is valid and warn user if not (alert)
function checkValidDoi(doiInput) {
	if (/^10\./.test(doiInput)) {
		return true;
	} else if (/^10\//.test(doiInput)) {
		return true;
	} else {
		alert(chrome.i18n.getMessage("invalidDoiAlert"));
		return false;
	}
}


function navigate(url) {
	chrome.tabs.query({
		active: true,
		currentWindow: true
	}, function(tabs) {
		chrome.tabs.update(tabs[0].id, {url: url});
	});
}

function resolveDOI(doi, useCustomResolver, tab) {
	var stgFetch = [
		"doi_resolver",
		"shortdoi_resolver"
	];

	storage.area.get(stgFetch, function(stg) {
		var str = "";
		var dr = stg["doi_resolver"];
		var sr = stg["shortdoi_resolver"];

		if (useCustomResolver) {
			if (/^10\./.test(doi)) str = dr + doi;
			else if (/^10\//.test(doi)) str = sr + doi.replace(/^10\//,"");
		} else {
			if (/^10\./.test(doi)) str = "http://dx.doi.org/" + doi;
			else if (/^10\//.test(doi)) str = "http://doi.org/" + doi.replace(/^10\//,"");
		}

		switch (tab) {
		case "newForegroundTab":
			chrome.tabs.create({url: str, active: true});
			break;
		case "newBackgroundTab":
			chrome.tabs.create({url: str, active: false});
			break;
		default: // "currentTab"
			navigate(str);
			break;
		}
	});
}

// Context menu
function contextMenuMaker() {
	chrome.contextMenus.create({
		"title" : chrome.i18n.getMessage("contextText"),
		"type" : "normal",
		"contexts" : ["selection"],
		"onclick" : contextMenuResolve
	});
}

function toggleContextMenu() {
	storage.area.get(["context_menu"], function(stg) {
		if (stg["context_menu"] === true) {
			chrome.contextMenus.removeAll(contextMenuMaker);
		} else {
			chrome.contextMenus.removeAll(null);
		}
	});
}

function contextMenuResolve(info) {
	var doiInput = encodeURI(trim(info.selectionText));
	if (!checkValidDoi(doiInput)) {
		return;
	}

	var stgFetch = [
		"custom_resolver",
		"cr_context"
	];

	storage.area.get(stgFetch, function(stg) {
		var cr = stg["custom_resolver"];
		var crc = stg["cr_context"];
		if (cr === true && crc === "custom") {
			resolveDOI(doiInput, true, "newForegroundTab");
		} else {
			resolveDOI(doiInput, false, "newForegroundTab");
		}
	});
}

// Message passing
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.cmd) {
	case "auto_link":
		autoLinkDOIs();
		break;
	case "toggle_sync":
		storageListener(false);
		toggleSync();
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
		if (removed) {
			console.log("Permissions cleaned");
		} else {
			console.log("Unable to cleanup permissions");
		}
	});
}

function tabRecord(id, add) {
	if (typeof tabRecord.openTabs === 'undefined') {
		tabRecord.openTabs = [];
	}

	if (add) {
		tabRecord.openTabs.push(id);
	} else {
		var index = tabRecord.openTabs.indexOf(id);
		tabRecord.openTabs.splice(index, 1);
	}
}

function permRemoveListeners() {
	chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
		if (typeof tabRecord.openTabs != 'undefined' && tabRecord.openTabs.indexOf(tabId) >= 0) {
			chrome.permissions.remove({
				origins: [
					'http://*.doi.org/',
					'http://*.crossref.org/',
					'http://*.datacite.org/',
					'https://raw.githubusercontent.com/'
				]
			}, function(removed) {
				if (removed) {
					console.log("Removed qr/citation-related permissions");
				} else {
					console.log("Unable to remove qr/citation-related permissions");
				}
			});
			tabRecord(tabId, false);
		}
	});
}

// Auto-link
function alListener(tabId, changeInfo, tab) {
	chrome.permissions.contains({
		origins: [ 'http://*/*', 'https://*/*' ]
	}, function(result) {
		if (result && tab.url.indexOf("https://chrome.google.com/webstore") === 0) {
			return;
		}

		if (result && tab.url.indexOf("http") === 0) {
			chrome.tabs.executeScript(tabId, {file: "autolink.js"});
		} else {
			chrome.permissions.contains({
				origins: [ 'http://*/*' ]
			}, function(result) {
				if (result && tab.url.indexOf("http") === 0 && tab.url.indexOf("https") < 0) {
					chrome.tabs.executeScript(tabId, {file: "autolink.js"});
				} else {
					chrome.permissions.contains({
						origins: [ 'https://*/*' ]
					}, function(result) {
						if (result && tab.url.indexOf("https") === 0) {
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
		if (result) {
			chrome.storage.local.set({
				auto_link: true,
				al_protocol: "httphttps"
			}, function() {
				chrome.tabs.onUpdated.addListener(alListener);
				console.log('Autolink listeners enabled for http and https');
				chrome.runtime.sendMessage({cmd: "auto_link_config_complete"});
			});
		} else {
			chrome.permissions.contains({
				permissions: [ 'tabs' ],
				origins: [ 'http://*/*' ]
			}, function(result) {
				if (result) {
					chrome.storage.local.set({
						auto_link: true,
						al_protocol: "http"
					}, function() {
						chrome.tabs.onUpdated.addListener(alListener);
						console.log('Autolink listeners enabled for http');
						chrome.runtime.sendMessage({cmd: "auto_link_config_complete"});
					});
				} else {
					chrome.permissions.contains({
						permissions: [ 'tabs' ],
						origins: [ 'https://*/*' ]
					}, function(result) {
						if (result) {
							chrome.storage.local.set({
								auto_link: true,
								al_protocol: "https"
							}, function() {
								chrome.tabs.onUpdated.addListener(alListener);
								console.log('Autolink listeners enabled for https');
								chrome.runtime.sendMessage({cmd: "auto_link_config_complete"});
							});
						} else {
							chrome.storage.local.set({ auto_link: false }, function() {
								console.log('Autolink listeners disabled');
								chrome.runtime.sendMessage({cmd: "auto_link_config_complete"});
							});
						}
					});
				}
			});
		}
	});
}

// Omnibox
function omniListener(text, disposition) {
	var stgFetch = [
		"omnibox_tab",
		"custom_resolver",
		"cr_omnibox"
	];

	storage.area.get(stgFetch, function(stg) {
		console.log('omnibox: ' + text);

		var doiInput = encodeURI(trim(text));
		if (!checkValidDoi(doiInput)) {
			return;
		}

		var ot = stg["omnibox_tab"];
		var cr = stg["custom_resolver"];
		var cro = stg["cr_omnibox"];
		var tab;

		switch (ot) {
		case "newfgtab":
			tab = "newForegroundTab";
			break;
		case "newbgtab":
			tab = "newBackgroundTab";
			break;
		case "curtab":
			tab = "currentTab";
			break;
		default:
			tab = disposition;
			break;
		}

		if (cr === true && cro === "custom") {
			resolveDOI(doiInput, true, tab);
		} else {
			resolveDOI(doiInput, false, tab);
		}
	});
}

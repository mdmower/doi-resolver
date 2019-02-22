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
	beginInit();
}, false);

function beginInit() {
	startListeners();
	cleanupPermissions()
	.then(checkForNewOptions)
	.then(startBackgroundFeatures);
}

function startListeners() {
	chrome.storage.onChanged.addListener(storageChangeHandler);
	chrome.omnibox.onInputEntered.addListener(omniListener);

	chrome.tabs.onRemoved.addListener(function(tabId) {
		if (!Array.isArray(tabRecord.openTabs) || tabRecord.openTabs.length === 0) {
			return;
		}

		if (tabRecord.openTabs.indexOf(tabId) >= 0) {
			if (tabRecord.openTabs.length === 1) {
				cleanupPermissions(); // Async OK
				tabRecord.openTabs = [];
			} else {
				tabRecord(tabId, false);
			}
		}
	});

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		switch(request.cmd) {
		case "autolink_vars":
			sendAutolinkVariables(sendResponse);
			break;
		default:
			break;
		}

		return true; // Required to allow async sendResponse
	});
}

function allOptions() {
	return [
		"auto_link",
		"auto_link_rewrite",
		"autolink_exclusions",
		"cite_locale",
		"cite_style",
		"context_menu",
		"cr_autolink",
		"cr_bubble",
		"cr_bubble_last",
		"cr_context",
		"cr_history",
		"cr_omnibox",
		"custom_resolver",
		"doi_resolver",
		"history",
		"history_doi_queue",
		"history_fetch_title",
		"history_length",
		"history_showsave",
		"history_showtitles",
		"history_sortby",
		"meta_buttons",
		"omnibox_tab",
		"qr_bgcolor",
		"qr_bgtrans",
		"qr_border",
		"qr_fgcolor",
		"qr_imgtype",
		"qr_message",
		"qr_size",
		"qr_title",
		"recorded_dois",
		"shortdoi_resolver",
		"sync_data",
		"sync_reset"
	];
}

function excludeFromSync() {
	return [
		"auto_link", // Requires permissions to enable
		"history_doi_queue", // Queue for recordDoi
		"history_fetch_title", // Requires permissions to enable
		"qr_title", // Requires permissions to enable
		"sync_data", // Controls sync on/off
		"sync_reset" // Only stored in storage.sync
	];
}

Array.prototype.diff = function(a) {
	return this.filter(function(i) {
		return a.indexOf(i) < 0;
	});
};

function getDefaultOption(opt) {
	var defaultOptions = {
		auto_link: false,
		auto_link_rewrite: false,
		autolink_exclusions: [],
		cite_locale: "auto",
		cite_style: "bibtex",
		context_menu: true,
		cr_autolink: "custom",
		cr_bubble: "custom",
		cr_bubble_last: "custom",
		cr_context: "custom",
		cr_history: "custom",
		cr_omnibox: "custom",
		custom_resolver: false,
		doi_resolver: getDefaultResolver(),
		history: false,
		history_doi_queue: [],
		history_fetch_title: false,
		history_length: 50,
		history_showsave: false,
		history_showtitles: false,
		history_sortby: "date",
		meta_buttons: true,
		omnibox_tab: "newfgtab",
		qr_bgcolor: "#ffffff",
		qr_bgtrans: false,
		qr_border: 0,
		qr_fgcolor: "#000000",
		qr_imgtype: "png",
		qr_message: false,
		qr_size: 300,
		qr_title: false,
		recorded_dois: [],
		shortdoi_resolver: getDefaultResolver(),
		sync_data: false
		// sync_reset is not stored locally and does not need a default
	};

	return defaultOptions[opt]; // returns 'undefined' if option not found
}

function checkForNewOptions() {
	return new Promise((resolve) => {

		var options = allOptions().diff(["sync_reset"]);
		chrome.storage.local.get(options, function(stg) {
			var newOptions = {};
			var updateSettings = false;

			options.forEach((option) => {
				if (stg[option] === undefined) {
					newOptions[option] = getDefaultOption(option);
					updateSettings = true;
				}
			});

			if (updateSettings) {
				chrome.storage.local.set(newOptions, resolve);
			} else {
				resolve();
			}
		});

	});
}

/*
 * Before running toggleSync, ensure:
 * - sync_data is set correctly in chrome.storage.local
 * - sync_reset is set correctly in chrome.storage.sync
 * - storageListener is disabled
 */
function toggleSync() {
	chrome.storage.local.get(null, function(stgLocal) {
	chrome.storage.sync.get(null, function(stgSync) {
		var toLocal = {};
		var toSync = {};
		var syncOptions = allOptions().diff(excludeFromSync());

		if (stgLocal.sync_data && !stgSync.sync_reset) {
			// Sync was just toggled-on, so let sync storage options overwrite
			// local storage options, so long as they are defined. If an option
			// is not defined in sync storage, copy it from local storage, which
			// is guaranteed to exist since checkForNewOptions() runs at start-up
			console.log("Importing settings from chrome.storage.sync");
			syncOptions.forEach((option) => {
				if (stgSync[option] !== undefined) {
					toLocal[option] = stgSync[option];
				} else {
					toSync[option] = stgLocal[option];
				}
			});
			console.log(".. toSync: ", toSync);
			console.log(".. toLocal: ", toLocal);
			chrome.storage.sync.set(toSync, function() {
			chrome.storage.local.set(toLocal, function() {
				storageListener(true);
				chrome.runtime.sendMessage({
					cmd: "settings_updated",
					data: toLocal,
					force_update: true
				});
			});
			});
		} else if (!stgLocal.sync_data && !stgSync.sync_reset) {
			// Nothing needs to be done, just log it and send the message
			console.log("Disabling settings synchronization; using chrome.storage.local");
			storageListener(true);
			chrome.runtime.sendMessage({
				cmd: "settings_updated",
				data: {},
				force_update: false
			});
		} else if (stgSync.sync_reset) {
			console.log("Wiping sync storage; using chrome.storage.local");
			chrome.storage.sync.clear(function() {
			chrome.storage.sync.set({sync_reset: true}, function() {
				storageListener(true);
				chrome.runtime.sendMessage({
					cmd: "settings_updated",
					data: {},
					force_update: false
				});
			});
			});
		}
	});
	});
}

function storageListener(enable) {
	storageListener.status = Boolean(enable);
}

/*
 * storageChangeHandler only gets fired when a setting is modified from its previous
 * state. So, when options are saved -- even though they get batched together -- if
 * sync_data is the only value that actually changes value, then only it will be
 * included in the changes parameter here.
 *
 * toggleSync expects the storageListener to be disabled, so be sure to do that here
 * before calling it.
 */
function storageChangeHandler(changes, namespace) {
	if (!storageListener.status) {
		return;
	}

	if (namespace !== "local" && namespace !== "sync") {
		return;
	}

	chrome.storage.local.get(["sync_data"], function(stg) {
		var change;
		var syncOptions = allOptions().diff(excludeFromSync());

		/* Debugging */
		// for (change in changes) {
		// 	if (changes.hasOwnProperty(change)) {
		// 		console.log("Change in " + namespace + " storage, " + change + ": ", changes[change]);
		// 	}
		// }

		if (namespace === "sync") {
			if (changes.sync_reset !== undefined && changes.sync_reset.newValue) {
				storageListener(false);
				chrome.storage.local.set({sync_data: false}, function() {
					toggleSync();
				});
				return;
			}
			if (stg.sync_data) {
				updateBackgroundFeatureStates(changes);
			}
		} else if (namespace === "local") {
			if (changes.sync_data !== undefined) {
				storageListener(false);
				if (changes.sync_data.newValue) {
					chrome.storage.sync.set({sync_reset: false}, function() {
						toggleSync();
					});
				} else {
					toggleSync();
				}
				return;
			}
			updateBackgroundFeatureStates(changes);
		}

		var updatedOptions = {};
		for (change in changes) {
			if (changes.hasOwnProperty(change) && syncOptions.indexOf(change) >= 0) {
				updatedOptions[change] = changes[change].newValue;
			}
		}

		var historyRefreshOptions = [
			"cr_history",
			"custom_resolver",
			"doi_resolver",
			"history_sortby",
			"recorded_dois",
			"shortdoi_resolver"
		];
		var historyUpdate = false;
		for (var i = 0; i < historyRefreshOptions.length; i++) {
			if (updatedOptions[historyRefreshOptions[i]] !== undefined) {
				historyUpdate = true;
				break;
			}
		}

		if (stg.sync_data) {
			var newNamespace = namespace === "local" ? "sync" : "local";
			storageListener(false);
			chrome.storage[newNamespace].set(updatedOptions, function() {
				storageListener(true);
				chrome.runtime.sendMessage({
					cmd: "settings_updated",
					data: updatedOptions,
					force_update: historyUpdate
				});
			});
		} else if (namespace === "local") {
			chrome.runtime.sendMessage({
				cmd: "settings_updated",
				data: updatedOptions,
				force_update: historyUpdate
			});
		}
	});
}

function startBackgroundFeatures() {
	var stgFetch = [
		"auto_link",
		"context_menu"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
		if (stg.auto_link) {
			autolinkDois()
			.then((enabled) => {
				if (!enabled) {
					console.log("Autolink was enabled in settings, but had to be disabled since necessary permissions are not available");
				}
				storageListener(true);
			});
		} else {
			storageListener(true);
		}
		if (stg.context_menu) {
			toggleContextMenu(true);
		}
	});
}

function updateBackgroundFeatureStates(changes) {
	console.log('updateBackgroundFeatureStates\n', changes);
	if (changes.context_menu !== undefined) {
		toggleContextMenu(changes.context_menu.newValue);
	}
	if (changes.history_doi_queue !== undefined) {
		var queue = changes.history_doi_queue.newValue;
		if (Array.isArray(queue) && queue.length > 0) {
			chrome.storage.local.set({history_doi_queue: []}, function () {
				console.log('DOI(s) queued for history: ' + queue.join(', '));
				Promise.all(queue.map(recordDoi))
				.catch((errMsg) => {
					console.log(errMsg);
				})
				.finally(removeDoiMetaPermissions);
			});
		}
	}
}

// Remove spaces and punctuation from beginning and end of input
function trim(stringToTrim) {
	return stringToTrim.replace(/^\s*doi:?|\s+|[^A-Z0-9)>]+$/ig, "");
}

// Check that DOI is valid
function checkValidDoi(doiInput) {
	return /^10[\.\/]/.test(doiInput);
}

function navigate(url) {
	chrome.tabs.query({
		active: true,
		currentWindow: true
	}, function(tabs) {
		chrome.tabs.update(tabs[0].id, {url: url});
	});
}

function getDefaultResolver() {
	return "https://doi.org/";
}

function resolveDOI(doi, useCustomResolver, tab) {
	var stgFetch = [
		"doi_resolver",
		"shortdoi_resolver"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
		var doiUrl;

		if (useCustomResolver) {
			if (/^10\//.test(doi)) {
				doiUrl = stg.shortdoi_resolver + doi.replace(/^10\//,"");
			} else {
				doiUrl = stg.doi_resolver + doi;
			}
		} else {
			if (/^10\//.test(doi)) {
				doiUrl = getDefaultResolver() + doi.replace(/^10\//,"");
			} else {
				doiUrl = getDefaultResolver() + doi;
			}
		}

		switch (tab) {
		case "newForegroundTab":
			chrome.tabs.create({url: doiUrl, active: true});
			break;
		case "newBackgroundTab":
			chrome.tabs.create({url: doiUrl, active: false});
			break;
		default: // "currentTab"
			navigate(doiUrl);
			break;
		}
	});
}

function fetchDoiTitle(doi) {
	return new Promise(function(resolve) {

		chrome.permissions.contains({
			origins: [
				"https://*.doi.org/",
				"https://*.crossref.org/",
				"https://*.datacite.org/",
				"https://*.medra.org/"
			]
		}, function(granted) {
			if (!granted) {
				return resolve("");
			}

			var fetchHeaders = new Headers();
			fetchHeaders.append("Accept", "application/vnd.citationstyles.csl+json");

			var fetchInit = {
				method: "GET",
				headers: fetchHeaders,
				cache: "no-cache"
			};

			var jsonUrl = getDefaultResolver() + doi;
			var fetchRequest = new Request(jsonUrl, fetchInit);

			fetch(fetchRequest)
			.then(function(response) {
				return response.json();
			})
			.then(function(json) {
				var title = json.title;
				if (typeof json.title !== "string")
					return resolve("");

				title = title.replace(/<subtitle>(.*)<\/subtitle>/, " - $1");
				title = title.replace(/<alt-title>(.*)<\/alt-title>/, "");
				title = title.replace(/<[^>]*>([^<]*)<\/[^>]*>/, "$1");
				resolve(title.trim());
			})
			.catch(function(error) {
				console.log("fetchDoiTitle failed", error);
				resolve("");
			});
		});

	});
}

function getSavedDoiTitle(doi) {
	return new Promise(function(resolve) {

		var stgFetch = [
			"history",
			"recorded_dois"
		];

		chrome.storage.local.get(stgFetch, function(stg) {
			if (stg.history !== true || !Array.isArray(stg.recorded_dois)) {
				return resolve("");
			}

			var index = stg.recorded_dois.findIndex(function(item) {
				return item.doi === doi;
			});
			if (index >= 0) {
				var title = stg.recorded_dois[index].title;
				resolve(title ? title : "");
			}

			resolve("");
		});

	});
}

function removeDoiMetaPermissions(callback) {
	chrome.permissions.remove({
		origins: [
			"https://*.doi.org/",
			"https://*.crossref.org/",
			"https://*.datacite.org/",
			"https://*.medra.org/"
		]
	}, callback);
}

function recordDoiAction(doi) {
	return new Promise((resolve) => {
		var stgFetch = [
			"history",
			"history_doi_queue"
		];

		chrome.storage.local.get(stgFetch, function(stg) {
			if (stg.history === true) {
				if (!Array.isArray(stg.history_doi_queue))
					stg.history_doi_queue = [doi];
				else
					stg.history_doi_queue.push(doi);
				delete stg.history;
				chrome.storage.local.set(stg, resolve);
			}
		});
	});
}

// Recognized states for title parameter:
// - string: save title provided by parameter
// - undefined: try to fetch title
// - false: do not try to fetch title (QR already tried and failed)
function recordDoi(doi, title) {
	return new Promise((resolve, reject) => {

		var stgFetch = [
			"history",
			"history_length",
			"history_fetch_title",
			"recorded_dois"
		];

		chrome.storage.local.get(stgFetch, function(stg) {
			if (stg.history !== true) {
				return resolve();
			}
			if (!Array.isArray(stg.recorded_dois)) {
				stg.recorded_dois = getDefaultOption("recorded_dois");
			}
			if (stg.history_length === undefined) {
				stg.history_length = getDefaultOption("history_length");
			}

			// Remove holes from the array (should not occur)
			stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
				// Use !=, not !==, so that null is caught as well
				return elm != undefined;
			});

			/* The number of recorded entries may exceed the history length if
			 * the user has saved N entries and later sets the history length to
			 * less than N. Do not take action; only handle the case of equal
			 * history length and number of entries below.
			 */
			if (stg.recorded_dois.length > Number(stg.history_length)) {
				return reject("Number of recorded DOIs exceeds history length option");
			}

			var index = stg.recorded_dois.findIndex(function(item) {
				return item.doi === doi;
			});
			if (index >= 0) {
				// DOI already exists in history, get/overwrite title if needed
				if (title) {
					stg.recorded_dois[index].title = title;
					chrome.storage.local.set(stg, resolve);
				} else if (!stg.history_fetch_title || stg.recorded_dois[index].title) {
					resolve();
				} else if (title === false ) {
					resolve();
				} else {
					fetchDoiTitle(doi)
					.then(function(title) {
						if (title) {
							stg.recorded_dois[index].title = title;
							chrome.storage.local.set(stg, resolve);
						} else {
							resolve();
						}
					});
				}
				return;
			}

			var shifted = false;
			if (stg.recorded_dois.length === parseInt(stg.history_length)) {
				// Do not remove saved entries
				for (var i = 0; i < stg.recorded_dois.length; i++) {
					if (stg.recorded_dois[i].save !== true) {
						stg.recorded_dois.splice(i, 1);
						shifted = true;
						break;
					}
				}
				if (!shifted) {
					// All entries are marked for save
					return reject("Number of recorded DOIs marked 'save' equals history length option");
				}
			}

			var doiObject = {
				doi: doi,
				title: title ? title : "",
				save: false
			};

			if (title || title === false || !stg.history_fetch_title) {
				stg.recorded_dois.push(doiObject);
				chrome.storage.local.set(stg, resolve);
			} else {
				fetchDoiTitle(doi)
				.then(function(title) {
					if (title) {
						doiObject.title = title;
					}
					stg.recorded_dois.push(doiObject);
					chrome.storage.local.set(stg, resolve);
				});
			}
		});

	});
}

function sortHistoryEntries(entries, method) {
	function doiCompare(a, b) {
		if (a.doi.toLowerCase() < b.doi.toLowerCase())
			return -1;
		if (a.doi.toLowerCase() > b.doi.toLowerCase())
			return 1;
		return 0;
	}
	function titleCompare(a, b) {
		// Sort blank titles at end of list
		if (!a.title && b.title)
			return 1;
		if (a.title && !b.title)
			return -1;

		if (a.title.toLowerCase() < b.title.toLowerCase())
			return -1;
		if (a.title.toLowerCase() > b.title.toLowerCase())
			return 1;
		return 0;
	}
	function saveCompare(a, b) {
		if (a.save && !b.save)
			return -1;
		if (!a.save && b.save)
			return 1;
		return 0;
	}

	switch(method) {
		case "doi":
			entries.sort(doiCompare);
			break;
		case "title":
			entries.sort(titleCompare);
			break;
		case "save":
			entries.reverse();
			entries.sort(saveCompare);
			break;
		case "date":
			entries.reverse();
			break;
		default:
			break;
	}
}

function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function filterSelectByText(select, text, trySelect) {
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
			if (regex.test(option.textContent)) {
				option.style.display = '';
				visibleOptions.push(option);
			} else {
				option.selected = false;
				option.style.display = 'none';
			}
		});

		if (visibleOptions.length > 0) {
			if (trySelect && select.selectedOptions.length === 0) {
				visibleOptions[0].selected = true;
			}
			if (select.selectedOptions.length > 0) {
				select.selectedOptions[0].scrollIntoView();
			}
		}
	}
}

function toggleContextMenu(enable) {
	chrome.contextMenus.removeAll(function() {
		if (enable) {
			chrome.contextMenus.create({
				"title" : chrome.i18n.getMessage("contextText"),
				"type" : "normal",
				"contexts" : ["selection"],
				"onclick" : contextMenuResolve
			});
		}
	});
}

function contextMenuResolve(info) {
	var doiInput = encodeURI(trim(info.selectionText));
	var doiPrefixRegEx = new RegExp("^doi\:?", "ig");
	doiInput = doiInput.replace(doiPrefixRegEx, '');

	if (!checkValidDoi(doiInput)) {
		alert(chrome.i18n.getMessage("invalidDoiAlert"));
		return;
	}

	var stgFetch = [
		"custom_resolver",
		"cr_context"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
		var cr = stg.custom_resolver;
		var crc = stg.cr_context;
		resolveDOI(doiInput, cr === true && crc === "custom", "newForegroundTab");
	});
}

function cleanupPermissions() {
	return new Promise((resolve) => {

		chrome.storage.local.get(["auto_link"], function(stg) {
			var removeOrigins = [
				'https://*.doi.org/',
				'https://*.crossref.org/',
				'https://*.datacite.org/',
				'https://raw.githubusercontent.com/'
			];

			if (!stg.auto_link) {
				removeOrigins.push('http://*/*');
				removeOrigins.push('https://*/*');
			}

			chrome.permissions.remove({
				origins: removeOrigins
			}, function(removed) {
				console.log("Permission cleanup " + (removed ? "successful" : "unsuccessful"));
				resolve();
			});
		});

	});
}

function tabRecord(id, add) {
	// tabRecord() is called from citation.js and qr.js when those pages open,
	// so it is not necessary to run tabRecord() separately in the background
	// to initialize tabRecord.openTabs
	if (tabRecord.openTabs === undefined) {
		tabRecord.openTabs = [];
	}

	if (add) {
		tabRecord.openTabs.push(id);
	} else {
		var index = tabRecord.openTabs.indexOf(id);
		tabRecord.openTabs.splice(index, 1);
	}
}

// Autolink

function sendAutolinkVariables(sendResponse) {
	var stgFetch = [
		"cr_autolink",
		"auto_link_rewrite",
		"custom_resolver",
		"doi_resolver"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
		var response = {};
		if (stg.custom_resolver && stg.cr_autolink == "custom") {
			response.doiResolver = stg.doi_resolver;
		} else {
			response.doiResolver = getDefaultResolver();
		}
		response.autolinkRewrite = stg.auto_link_rewrite;

		sendResponse(response);
	});
}

function autolinkTestExclusions(url, autolinkExclusions) {
	function exclusionTest(exclusions) {
		if (!Array.isArray(exclusions)) {
			return true;
		}

		if (typeof url !== 'string' ||
				!/^https?:\/\//i.test(url) ||
				url.indexOf("https://chrome.google.com/webstore") === 0) {
			return true;
		}

		var urlNoProtocol = url.replace(/^https?\:\/\//i, "").toLowerCase();
		var exclusion = "";
		var re;
		for (var i = 0; i < exclusions.length; i++) {
			exclusion = exclusions[i];
			if (exclusion.charAt(0) === "/" && exclusion.slice(-1) === "/") {
				try {
					re = new RegExp(exclusion.slice(1, -1), "i");
				} catch(ex) {
					console.log("Invalid regular expression", exclusion, ex);
					continue;
				}
				if (re.test(urlNoProtocol)) {
					return true;
				}
			} else if (urlNoProtocol.indexOf(exclusion.toLowerCase()) === 0) {
				return true;
			}
		}

		return false;
	}

	return new Promise((resolve) => {
		if (autolinkExclusions !== undefined) {
			resolve(exclusionTest(autolinkExclusions));
		} else {
			chrome.storage.local.get(["autolink_exclusions"], function(stg) {
				resolve(exclusionTest(stg.autolink_exclusions));
			});
		}
	});
}

function autolinkListener(tabId, changeInfo, tab) {
	if (changeInfo.status !== "complete") {
		return;
	}

	autolinkTestExclusions(tab.url)
	.then((exclude) => {
		if (exclude) {
			return;
		}
		chrome.tabs.executeScript(tabId, {file: "autolink.js"}, function(results) {
			if (chrome.runtime.lastError || results === undefined) {
				console.log("Autolink failed to run on " + tab.url);
			}
		});
	});
}

function autolinkToggleListener(enable) {
	if (enable) {
		chrome.tabs.onUpdated.addListener(autolinkListener);
	} else {
		chrome.tabs.onUpdated.removeListener(autolinkListener);
	}
}

function autolinkDois() {
	return new Promise((resolve) => {

		autolinkToggleListener(false);
		autolinkVerifyPermissions()
		.then((result) => {
			if (result) {
				chrome.storage.local.set({ auto_link: true }, function() {
					autolinkToggleListener(true);
					console.log('Autolink listeners enabled for http and https');
					resolve(true);
				});
			} else {
				chrome.storage.local.set({ auto_link: false }, function() {
					console.log('Autolink listeners disabled');
					resolve(false);
				});
			}
		});

	});
}

function autolinkVerifyPermissions() {
	return new Promise((resolve) => {

		chrome.permissions.contains({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*', 'https://*/*' ]
		}, function(result) {
			resolve(result);
		});

	});
}

// Omnibox
function omniListener(text, disposition) {
	var stgFetch = [
		"omnibox_tab",
		"custom_resolver",
		"cr_omnibox"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
		console.log('omnibox: ' + text);

		var doiInput = encodeURI(trim(text));
		var doiPrefixRegEx = new RegExp("^doi\:?", "ig");
		doiInput = doiInput.replace(doiPrefixRegEx, '');

		if (!checkValidDoi(doiInput)) {
			alert(chrome.i18n.getMessage("invalidDoiAlert"));
			return;
		}

		var ot = stg.omnibox_tab;
		var cr = stg.custom_resolver;
		var cro = stg.cr_omnibox;
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

		resolveDOI(doiInput, cr === true && cro === "custom", tab);
	});
}

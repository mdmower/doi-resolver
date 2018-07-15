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

document.addEventListener("DOMContentLoaded", function () {
	storage(true, true);
}, false);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.cmd) {
	case "sync_toggle_complete":
		storage(false, true);
		break;
	case "settings_dup_complete":
		storage(false, false);
		break;
	default:
		break;
	}
});

function storage(firstRun, restore) {
	if (typeof storage.area === "undefined") {
		storage.area = chrome.storage.local;
	}

	chrome.storage.local.get(["sync_data"], function(stg) {
		if (stg.sync_data === true) {
			storage.area = chrome.storage.sync;
			storageListener(true);
		} else {
			storage.area = chrome.storage.local;
			storageListener(false);
		}

		if (firstRun === true) {
			continueOnLoad();
		}
		if (restore === true) {
			restoreOptions(populateHistory);
		}
	});
}

function continueOnLoad() {
	getLocalMessages();
	startClickListeners();
	restoreHashPage();
	chrome.storage.onChanged.addListener(storageChangeHandler);
}

function restoreHashPage() {
	var knownHashes = [
		"options",
		"history",
		"about"
	];

	for (var i = 0; i < knownHashes.length; i++) {
		if (location.hash === "#" + knownHashes[i]) {
			toggleTab(knownHashes[i]);
			break;
		}
	}
}

function toggleTab(tab) {
	document.getElementById(tab + "_tab").checked = true;
	location.hash = tab;
}

function startClickListeners() {
	Array.from(document.querySelectorAll('input[name="tab-control"]')).forEach(function(elm) {
		elm.addEventListener("change", function() {
			if (this.checked) {
				location.hash = this.id.replace("_tab", "");
			}
		});
	});

	document.getElementById("doiResolverInputReset").addEventListener("click", function() {
		var input = document.getElementById("doiResolverInput");
		if (input.value !== "https://dx.doi.org/") {
			var change = new Event("change");
			input.value = "https://dx.doi.org/";
			input.dispatchEvent(change);
		}
	});
	document.getElementById("shortDoiResolverInputReset").addEventListener("click", function() {
		var input = document.getElementById("shortDoiResolverInput");
		if (input.value !== "https://doi.org/") {
			var change = new Event("change");
			input.value = "https://doi.org/";
			input.dispatchEvent(change);
		}
	});

	document.getElementById("img_context_off").addEventListener("click", function() {
		var input = document.getElementById("context");
		if (input.checked) {
			input.click();
		}
	});
	document.getElementById("img_context_on").addEventListener("click", function() {
		var input = document.getElementById("context");
		if (!input.checked) {
			input.click();
		}
	});

	document.getElementById("img_bubblemeta_off").addEventListener("click", function() {
		var input = document.getElementById("meta");
		if (input.checked) {
			input.click();
		}
	});
	document.getElementById("img_bubblemeta_on").addEventListener("click", function() {
		var input = document.getElementById("meta");
		if (!input.checked) {
			input.click();
		}
	});

	document.getElementById("historyTitleRefresh").addEventListener("click", populateMissingTitles);
	document.getElementById("historyClear").addEventListener("click", deleteHistory);

	document.getElementById("syncDataWipeButton").addEventListener("click", function() {
		document.getElementById("syncData").checked = false;
		/* background listens for sync_reset == true */
		chrome.storage.sync.set({sync_reset: true}, null);
	});
}

function getSaveMap() {
	/*
	 * doiResolverInput, shortDoiResolverInput, historyLength
	 * These can fire onChange events frequently. debounce them to only
	 * run once per 750ms so Chrome Sync doesn't get too many sync requests.
	 */
	var dbSaveOptions = debounce(saveOptions, 750);
	var dbHistoryLengthUpdate = debounce(historyLengthUpdate, 750);

	return [
		{ selector: "#history", func: saveOptions, events: ['change'] },
		{ selector: "#historyShowSave", func: saveOptions, events: ['change'] },
		{ selector: "#historyShowTitles", func: saveOptions, events: ['change'] },
		{ selector: "#historySortBy", func: saveOptions, events: ['change'] },
		{ selector: "#historyLength", func: dbHistoryLengthUpdate, events: ['change'] },
		{ selector: "#historyFetchTitle", func: setHistoryTitlePermissions, events: ['change'] },
		{ selector: "#context", func: saveOptions, events: ['change'] },
		{ selector: "#meta", func: saveOptions, events: ['change'] },
		{ selector: "#autolink", func: saveOptions, events: ['change'] },
		{ selector: "#autolinkRewrite", func: saveOptions, events: ['change'] },
		{ selector: "#customResolver", func: saveOptions, events: ['change'] },
		{ selector: ".crSelections", func: saveOptions, events: ['change'] },
		{ selector: "#doiResolverInput", func: dbSaveOptions, events: ['input', 'change'] },
		{ selector: "#doiResolverInput", func: setCrPreviews, events: ['input', 'change'] },
		{ selector: "#shortDoiResolverInput", func: dbSaveOptions, events: ['input', 'change'] },
		{ selector: "#shortDoiResolverInput", func: setCrPreviews, events: ['input', 'change'] },
		{ selector: "#omniboxOpento", func: saveOptions, events: ['change'] },
		{ selector: "#autolinkApplyTo", func: saveOptions, events: ['change'] },
		{ selector: "#autolinkExclusions", func: dbSaveOptions, events: ['input', 'change'] },
		{ selector: "#autolinkTestExclusion", func: autolinkTestExclusion, events: ['input', 'change'] },
		{ selector: "#syncData", func: toggleSync, events: ['change'] }
	];
}

function startChangeListeners() {
	getSaveMap().forEach(function(map) {
		Array.from(document.querySelectorAll(map.selector)).forEach(function(elm) {
			map.events.forEach(function(event) {
				elm.addEventListener(event, map.func);
			});
		});
	});
}

function haltChangeListeners() {
	getSaveMap().forEach(function(map) {
		Array.from(document.querySelectorAll(map.selector)).forEach(function(elm) {
			map.events.forEach(function(event) {
				elm.removeEventListener(event, map.func);
			});
		});
	});
}

function startHistoryChangeListeners() {
	Array.from(document.getElementsByClassName("history_input_save")).forEach(function(elm) {
		elm.addEventListener("change", saveHistoryEntry);
	});
	Array.from(document.getElementsByClassName("history_input_delete")).forEach(function(elm) {
		elm.addEventListener("click", deleteHistoryEntry);
	});
}

function haltHistoryChangeListeners() {
	Array.from(document.getElementsByClassName("history_input_save")).forEach(function(elm) {
		elm.removeEventListener("change", saveHistoryEntry);
	});
	Array.from(document.getElementsByClassName("history_input_delete")).forEach(function(elm) {
		elm.removeEventListener("click", deleteHistoryEntry);
	});
}

function toggleSync() {
	if (document.getElementById("syncData").checked) {
		chrome.storage.sync.set({sync_reset: false}, function() {
			chrome.storage.local.set({sync_data: true}, function() {
				chrome.extension.getBackgroundPage().toggleSync();
			});
		});
	} else {
		storageListener(false);
		chrome.storage.local.set({sync_data: false}, function() {
			chrome.extension.getBackgroundPage().toggleSync();
		});
	}
}

function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this;
		var args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) {
				func.apply(context, args);
			}
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait || 200);
		if (callNow) {
			func.apply(context, args);
		}
	};
}

function saveOptions() {
	minimalOptionsRefresh();

	var options = {
		auto_link_rewrite: document.getElementById("autolinkRewrite").checked,
		autolink_exclusions: document.getElementById("autolinkExclusions").value.split("\n").filter(Boolean),
		history: document.getElementById("history").checked,
		history_showsave: document.getElementById("historyShowSave").checked,
		history_showtitles: document.getElementById("historyShowTitles").checked,
		history_sortby: document.getElementById("historySortBy").value,
		history_length: Number(document.getElementById("historyLength").value),
		history_fetch_title: document.getElementById("historyFetchTitle").checked,
		context_menu: document.getElementById("context").checked,
		meta_buttons: document.getElementById("meta").checked,
		custom_resolver: document.getElementById("customResolver").checked,
		cr_autolink: document.getElementById("crAutolink").value,
		cr_bubble: document.getElementById("crBubble").value,
		cr_context: document.getElementById("crContext").value,
		cr_history: document.getElementById("crHistory").value,
		cr_omnibox: document.getElementById("crOmnibox").value,
		doi_resolver: document.getElementById("doiResolverInput").value,
		shortdoi_resolver: document.getElementById("shortDoiResolverInput").value,
		omnibox_tab: document.getElementById("omniboxOpento").value
	};

	/* If history is disabled, remove all history entries */
	if (!options.history) {
		options.recorded_dois = [];
		haltHistoryChangeListeners();
		removeAllHistoryEntries();
	}

	/*
	 * These options require permissions setting/checking. Only call them
	 * if the current setting differs from stored setting
	 */
	var autolinkCurrent = document.getElementById("autolink").checked;
	var autolinkProtocolCurrent = document.getElementById("autolinkApplyTo").value;

	var stgLclFetch = [
		"auto_link",
		"al_protocol"
	];

	chrome.storage.local.get(stgLclFetch, function(stgLocal) {
		var autolinkStorage = stgLocal.auto_link;
		var autolinkProtocolStorage = stgLocal.al_protocol;

		storageListener(false);
		if (autolinkCurrent != autolinkStorage || autolinkProtocolCurrent != autolinkProtocolStorage) {
			chrome.storage.local.set(options, function() {
				setAutolinkPermission(autolinkCurrent);
			});
		} else {
			/* Wait for message confirming .local to .sync duplication
			 * is complete in background before re-enabling storage
			 * listener here
			 */
			chrome.storage.local.set(options, null);
		}
	});
}

function restoreOptions(callback) {
	haltChangeListeners();

	var stgLclFetch = [
		"al_protocol",
		"sync_data"
	];

	var stgFetch = [
		"auto_link_rewrite",
		"autolink_exclusions",
		"history",
		"history_length",
		"history_fetch_title",
		"history_showsave",
		"history_showtitles",
		"history_sortby",
		"context_menu",
		"meta_buttons",
		"custom_resolver",
		"cr_autolink",
		"cr_bubble",
		"cr_context",
		"cr_history",
		"cr_omnibox",
		"doi_resolver",
		"shortdoi_resolver",
		"omnibox_tab"
	];

	chrome.storage.local.get(stgLclFetch, function(stgLocal) {
	storage.area.get(stgFetch, function(stg) {
		document.getElementById("doiResolverInput").value = stg.doi_resolver;
		document.getElementById("shortDoiResolverInput").value = stg.shortdoi_resolver;
		document.getElementById("history").checked = stg.history;
		document.getElementById("historyNotice").style.display = stg.history ? "none" : "";
		document.getElementById("historyShowSave").checked = stg.history_showsave;
		document.getElementById("historyShowTitles").checked = stg.history_showtitles;
		document.getElementById("historySortBy").value = stg.history_sortby;
		document.getElementById("historyLength").value = stg.history_length;
		document.getElementById("historyFetchTitle").checked = stg.history_fetch_title;
		document.getElementById("context").checked = stg.context_menu;
		document.getElementById("meta").checked = stg.meta_buttons;
		document.getElementById("customResolver").checked = stg.custom_resolver;
		document.getElementById("syncData").checked = stgLocal.sync_data;
		document.getElementById("crAutolink").value = stg.cr_autolink;
		document.getElementById("crBubble").value = stg.cr_bubble;
		document.getElementById("crContext").value = stg.cr_context;
		document.getElementById("crHistory").value = stg.cr_history;
		document.getElementById("crOmnibox").value = stg.cr_omnibox;
		document.getElementById("omniboxOpento").value = stg.omnibox_tab;
		document.getElementById("autolinkApplyTo").value = stgLocal.al_protocol;
		document.getElementById("autolinkRewrite").checked = stg.auto_link_rewrite;

		var autolinkExclusions = Array.isArray(stg.autolink_exclusions) ? stg.autolink_exclusions : [];
		document.getElementById("autolinkExclusions").value = autolinkExclusions.join("\n");

		// Depends on text fields being filled already, so call after #doiResolverInput
		// and #shortDoiResolverInput have been set.
		if (stg.custom_resolver) {
			setCrPreviews();
		}

		verifyAutolinkPermission(function() {
			startChangeListeners();
			if (typeof callback === "function") {
				callback();
			}
		});
	});
	});
}

// Only refresh fields that need updating after save
function minimalOptionsRefresh() {
	var customResolver = document.getElementById("customResolver").checked;
	var crAutolink = document.getElementById("crAutolink").value;
	if (customResolver) {
		setCrPreviews();
	}

	var history = document.getElementById("history").checked;
	document.getElementById("historyNotice").style.display = history ? "none" : "";

	/* There's no problem with this running async to the rest of
	 * saveOptions since a change to the autolink setting will
	 * call autolinkDisplayUpdate(). This minimal refresh is for
	 * the case of enabling custom resolver when autolink is
	 * already enabled.
	 */
	chrome.storage.local.get(["auto_link"], function(stg) {
		var showAlRewriteLinks = stg.auto_link && customResolver && crAutolink === "custom";
		document.getElementById("alRewriteLinks").style.display = showAlRewriteLinks ? "block" : "none";
	});
}

function storageListener(enable) {
	storageListener.status = Boolean(enable);
}

function storageChangeHandler(changes, namespace) {
	if (namespace === "local") {
		/* For the purpose of updating the history page, only the local
		 * namespace needs to be monitored since: 1) local changes are
		 * written to chrome.storage.local; and 2) changes brought in by
		 * sync will be copied to chrome.storage.local in the background
		 */
		if (changes.recorded_dois !== undefined || changes.history_sortby !== undefined) {
			populateHistory();
		}

		if (typeof changes.autolink_exclusions !== "undefined" && Array.isArray(changes.autolink_exclusions.newValue)) {
			autolinkTestExclusion();
		}
	}

	/* sync_reset is handled in the background page */
	if (namespace === "sync" && typeof changes.sync_reset === "undefined") {
		if (storageListener.status !== true) {
			return;
		}

		var options = [
			"auto_link_rewrite",
			"context_menu",
			"cr_autolink",
			"cr_bubble",
			"cr_context",
			"cr_history",
			"cr_omnibox",
			"custom_resolver",
			"doi_resolver",
			"history",
			"history_length",
			"history_showsave",
			"history_showtitles",
			"history_sortby",
			"meta_buttons",
			"omnibox_tab",
			"shortdoi_resolver"
		];

		for (var key in changes) {
			if (changes.hasOwnProperty(key)) {
				if (options.indexOf(key) >= 0) {
					restoreOptions(null);
					return;
				}
			}
		}
	}
}

function setCrPreviews() {
	var drInput = document.getElementById("doiResolverInput").value;
	var srInput = document.getElementById("shortDoiResolverInput").value;
	var drPreview = "";
	var srPreview = "";

	if (drInput.length <= 10) {
		drPreview = drInput + "10.1000/182";
	} else {
		drPreview = "&hellip;" + drInput.slice(-10, drInput.length) + "10.1000/182";
	}
	if (srInput.length <= 10) {
		srPreview = srInput + "dws9sz";
	} else {
		srPreview = "&hellip;" + srInput.slice(-10, srInput.length) + "dws9sz";
	}

	document.getElementById("doiResolverOutput").innerHTML = drPreview;
	document.getElementById("shortDoiResolverOutput").innerHTML = srPreview;
}

function autolinkDisplayUpdate(enabled, protocol) {
	var customResolver = document.getElementById("customResolver").checked;
	var crAutolink = document.getElementById("crAutolink").value;

	document.getElementById("autolink").checked = enabled;
	document.getElementById("alProtocol").style.display = enabled ? "block" : "none";
	document.getElementById("alExclusions").style.display = enabled ? "block" : "none";

	var showAlRewriteLinks = enabled && customResolver && crAutolink === "custom";
	document.getElementById("alRewriteLinks").style.display = showAlRewriteLinks ? "block" : "none";

	if (protocol !== null) {
		document.getElementById("autolinkApplyTo").value = protocol;
	}
}

function setAutolinkPermission(enabled) {
	/*
	 * We only want autolinking for user-enabled protocols, but we also don't
	 * want to burden the user with many alerts requesting permissions. Go
	 * ahead and request http+https permission, then remove unselected
	 * protocols.
	 *
	 * Migration note: This function only gets called if one of the autolink
	 * options changes. Users that enabled autolink previous to https being an
	 * option will be mostly unaffected. If they opt to include https pages,
	 * then they will get a new permissions prompt (good). If they disable and
	 * re-enable autolinking, they will also get a prompt (not ideal, but code
	 * complexity increases significantly for such a small issue).
	 */

	haltChangeListeners();

	if (enabled) {
		chrome.permissions.request({
			permissions: [ "tabs" ],
			origins: [ "http://*/*", "https://*/*" ]
		}, function(granted) {
			if (granted) {
				autolinkShufflePerms();
			} else {
				autolinkDisplayUpdate(false, null);
				startChangeListeners();
			}
		});
	} else {
		chrome.permissions.remove({
			permissions: [ "tabs" ],
			origins: [ "http://*/*", "https://*/*" ]
		}, function(removed) {
			if (removed) {
				autolinkDisplayUpdate(false, null);
				chrome.extension.getBackgroundPage().autolinkDois();
				startChangeListeners();
				console.log("Autolink permissions removed");
			} else {
				var protocol = document.getElementById("autolinkApplyTo").value;
				autolinkDisplayUpdate(true, protocol);
				chrome.extension.getBackgroundPage().autolinkDois();
				startChangeListeners();
				console.log("Could not remove autolink permissions");
			}
		});
	}
}

function autolinkShufflePerms() {
	// Only called if permissions have been granted by user
	var protocol = document.getElementById("autolinkApplyTo").value;

	if (protocol === "http") {
		chrome.permissions.remove({
			origins: [ "https://*/*" ]
		}, function(removed) {
			chrome.extension.getBackgroundPage().autolinkDois();
			verifyAutolinkPermission(startChangeListeners);
		});
	} else if (protocol === "https") {
		chrome.permissions.remove({
			origins: [ "http://*/*" ]
		}, function(removed) {
			chrome.extension.getBackgroundPage().autolinkDois();
			verifyAutolinkPermission(startChangeListeners);
		});
	} else {
		chrome.extension.getBackgroundPage().autolinkDois();
		verifyAutolinkPermission(startChangeListeners);
	}
}

function getHistoryUrl(doi) {
	var cr = document.getElementById("customResolver").checked;
	var crh = document.getElementById("crHistory").value;
	var dr = document.getElementById("doiResolverInput").value;
	var sr = document.getElementById("shortDoiResolverInput").value;
	var url = "";

	if (cr && crh === "custom") {
		if (/^10\./.test(doi)) {
			url = dr + doi;
		} else if (/^10\//.test(doi)) {
			url = sr + doi.replace(/^10\//,"");
		}
	} else {
		if (/^10\./.test(doi)) {
			url = "https://dx.doi.org/" + doi;
		} else if (/^10\//.test(doi)) {
			url = "https://doi.org/" + doi.replace(/^10\//,"");
		}
	}

	return url;
}

function populateHistory() {
	if (!document.getElementById("history").checked) {
		return;
	}

	haltHistoryChangeListeners();

	storage.area.get(["recorded_dois", "history_sortby"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		removeAllHistoryEntries();

		// Skip holes in the array (should not occur)
		stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
			// Use !=, not !==, so that null is caught as well
			return elm != undefined;
		});

		var sortHistoryEntries = chrome.extension.getBackgroundPage().sortHistoryEntries;
		sortHistoryEntries(stg.recorded_dois, stg.history_sortby);

		var historySeparator = document.getElementById("historySeparator");
		var historyEntry;
		for (var i = 0; i < stg.recorded_dois.length; i++) {
			historyEntry = generateHistoryEntry(stg.recorded_dois[i]);
			historySeparator.parentNode.appendChild(historyEntry);
		}

		startHistoryChangeListeners();
	});
}

function generateHistoryEntry(doiObject) {
	var escapeHtml = chrome.extension.getBackgroundPage().escapeHtml;
	var template = document.getElementById("history_entry_template");

	var clone = document.importNode(template.content, true);
	clone.querySelector(".history_entry").setAttribute('data-doi', doiObject.doi);
	clone.querySelector(".history_input_save").checked = doiObject.save;
	clone.querySelector(".history_entry_link").href = getHistoryUrl(doiObject.doi);
	clone.querySelector(".history_entry_link").innerHTML = doiObject.doi;
	clone.querySelector(".history_entry_title").innerHTML += escapeHtml(doiObject.title);
	clone.querySelector(".history_entry_title").title = escapeHtml(doiObject.title);
	clone.querySelector(".history_entry_title_copy").title = chrome.i18n.getMessage("historyCopyTitle");

	clone.querySelector(".history_entry_title_copy").addEventListener("click", function() {
		var fallbackCopy = function() {
			var textarea = document.createElement("textarea");
			textarea.id = "tempcopy";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.value = doiObject.title;
			textarea.select();
			document.execCommand("copy");
			document.body.removeChild(textarea);
		};

		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(doiObject.title)
			.then(function() {
				console.log("Title copied to clipboard");
			})
			.catch(function() {
				console.error("Unable to write to clipboard, trying fallback method");
				try {
					fallbackCopy();
				} catch (ex) {
					console.error("Fallback copy to clipboard method failed, giving up", ex);
				}
			});
		} else {
			try {
				fallbackCopy();
			} catch (ex) {
				console.error("Fallback copy to clipboard method failed, giving up", ex);
			}
		}
	});

	return clone;
}

function toggleHistorySpinner(enable) {
	var spinnerElm = document.querySelector("span.history_spinner");
	if (enable) {
		spinnerElm.classList.add("show_spinner");
	} else {
		spinnerElm.classList.remove("show_spinner");
	}
}

function populateMissingTitles() {
	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		var incompleteRecords = stg.recorded_dois.filter(function(record) {
			return !record.title;
		});
		var dois = incompleteRecords.map(function(record) {
			return record.doi;
		});

		if (dois.length === 0) {
			console.log("No DOIs are missing titles");
			return;
		}

		console.log("DOIs queued for title fetch", dois);

		toggleHistorySpinner(true);

		gatherNewDoiTitles(dois)
		.then(saveHistoryTitles)
		.then(function() {
			toggleHistorySpinner(false);
			populateHistory();
		})
		.catch(function(error) {
			toggleHistorySpinner(false);
			console.log("populateMissingTitles failed", error);
		});
	});
}

function gatherNewDoiTitles(dois) {
	return new Promise(function(resolve, reject) {

		if (!Array.isArray(dois) || dois.length === 0) {
			return reject("No DOIs requested for title fetch");
		}

		chrome.permissions.request({
			origins: [
				"https://*.doi.org/",
				"https://*.crossref.org/",
				"https://*.datacite.org/"
			]
		}, function(granted) {
			if (!granted) {
				return reject("Origin permissions not granted");
			}

			var gatherFetchResults = function(promises) {
				Promise.all(promises)
				.then(function(results) {
					var doiTitleReference = {};
					dois.forEach(function(doi) {
						doiTitleReference[doi] = results.pop();
					});
					console.log("Received titles for DOIs", doiTitleReference);
					resolve(doiTitleReference);
				});
			};

			// Two .pop() cycles are performed, so there is no need to reverse
			var doisClone = dois.slice();
			var fetchPromises = [];
			var interval = setInterval(function() {
				if (doisClone.length === 0) {
					clearInterval(interval);
					gatherFetchResults(fetchPromises);
				} else {
					var doi = doisClone.pop();
					console.log("Requesting title for DOI: " + doi);
					var promise = chrome.extension.getBackgroundPage().fetchDoiTitle(doi);
					fetchPromises.push(promise);
				}
			}, 200); // Space out fetch requests by 200ms each

		});

	});
}

function setHistoryTitlePermissions() {
	var historyFetchTitle = document.getElementById("historyFetchTitle");
	if (historyFetchTitle.checked) {
		chrome.permissions.request({
			origins: [
				"https://*.doi.org/",
				"https://*.crossref.org/",
				"https://*.datacite.org/"
			]
		}, function(granted) {
			historyFetchTitle.checked = granted;
			saveOptions();

			// Begin populating titles since option was just enabled
			// This should be safe to run async with saveOptions since
			// recorded_dois are not affected by saveOptions
		});
	} else {
		chrome.permissions.remove({
			origins: [
				"https://*.doi.org/",
				"https://*.crossref.org/",
				"https://*.datacite.org/"
			]
		}, function(removed) {
			historyFetchTitle.checked = !removed;
			saveOptions();
		});
	}
}

function saveHistoryTitles(doiTitleReference) {
	return new Promise(function(resolve) {

		if (!doiTitleReference || Object.keys(doiTitleReference).length === 0) {
			return;
		}

		storage.area.get(["recorded_dois"], function(stg) {
			if (!Array.isArray(stg.recorded_dois)) {
				return;
			}

			var stgUpdated = false;

			for (var doi in doiTitleReference) {
				if (doiTitleReference.hasOwnProperty(doi)) {
					var title = doiTitleReference[doi];

					var index = stg.recorded_dois.findIndex(function(item) {
						return item.doi === doi;
					});
					if (index >= 0) {
						stg.recorded_dois[index].title = title;
						stgUpdated = true;
					}
				}
			}

			if (stgUpdated) {
				chrome.storage.local.set(stg, resolve);
			} else {
				resolve();
			}
		});

	});
}

function saveHistoryEntry(event) {
	var save = event.target.checked;
	var entryElm = event.target;
	var doi = entryElm.getAttribute('data-doi');
	while (entryElm && !doi) {
		entryElm = entryElm.parentNode;
		doi = entryElm.getAttribute('data-doi');
	}

	if (!doi) {
		return;
	}

	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		var index = stg.recorded_dois.findIndex(function(item) {
			return item.doi === doi;
		});

		stg.recorded_dois[index].save = save;
		chrome.storage.local.set(stg, null);
	});
}

function deleteHistoryEntry(event) {
	var entryElm = event.target;
	var doi = entryElm.getAttribute('data-doi');
	while (entryElm && !doi) {
		entryElm = entryElm.parentNode;
		doi = entryElm.getAttribute('data-doi');
	}

	if (!doi) {
		return;
	}

	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		var index = stg.recorded_dois.findIndex(function(item) {
			return item.doi === doi;
		});

		stg.recorded_dois.splice(index, 1);
		entryElm.classList.add("fadeOut");
		setTimeout(function() {
			chrome.storage.local.set(stg, null);
		}, 300); // 300ms matches opacity transition in css
	});
}

function historyLengthUpdate() {
	var historyLength = Number(document.getElementById("historyLength").value);
	if (isNaN(historyLength) || historyLength < 1) {
		document.getElementById("historyLength").value = 1;
	} else if (historyLength > 500) {
		document.getElementById("historyLength").value = 500;
	}

	storage.area.get(["recorded_dois"], function(stg) {
		if (historyLength >= stg.recorded_dois.length) {
			saveOptions();
		} else {
			for (var i = 0; i < stg.recorded_dois.length; i++) {
				if (stg.recorded_dois[i].save !== true) {
					stg.recorded_dois.splice(i, 1);
					i--;
				}
				if (historyLength >= stg.recorded_dois.length) {
					break;
				}
			}
			chrome.storage.local.set({recorded_dois: stg.recorded_dois}, saveOptions);
		}
	});
}

function removeAllHistoryEntries() {
	var historyEntries = document.getElementsByClassName("history_entry");
	while (historyEntries.length > 0) {
		historyEntries[0].parentNode.removeChild(historyEntries[0]);
	}
}

function deleteHistory() {
	chrome.storage.local.set({recorded_dois: []}, null);
}

function verifyAutolinkPermission(callback) {
	chrome.permissions.contains({
		permissions: [ "tabs" ],
		origins: [ "http://*/*", "https://*/*" ]
	}, function(result) {
		if (result) {
			autolinkDisplayUpdate(true, "httphttps");
			if (typeof callback === 'function') {
				callback();
			}
		} else {
			chrome.permissions.contains({
				permissions: [ "tabs" ],
				origins: [ "http://*/*" ]
			}, function(result) {
				if (result) {
					autolinkDisplayUpdate(true, "http");
					if (typeof callback === 'function') {
						callback();
					}
				} else {
					chrome.permissions.contains({
						permissions: [ "tabs" ],
						origins: [ "https://*/*" ]
					}, function(result) {
						if (result) {
							autolinkDisplayUpdate(true, "https");
						} else {
							autolinkDisplayUpdate(false, null);
						}
						if (typeof callback === 'function') {
							callback();
						}
					});
				}
			});
		}
	});
}

function autolinkTestExclusion() {
	storage.area.get(["autolink_exclusions"], function(stg) {
		if (!Array.isArray(stg.autolink_exclusions)) {
			return;
		}

		var url = encodeURI(document.getElementById("autolinkTestExclusion").value).replace(/^https?\:\/\//i, "").toLowerCase();
		var exclusion = "";
		var re;
		var matched = false;
		for (var i = 0; i < stg.autolink_exclusions.length; i++) {
			exclusion = stg.autolink_exclusions[i];
			if (exclusion.slice(-1) === "/" && exclusion.charAt(0) === "/") {
				try {
					re = new RegExp(exclusion.slice(1, -1), "i");
				} catch(e) {
					continue;
				}
				if (url.match(re)) {
					matched = true;
					break;
				}
			} else if (url.indexOf(exclusion.toLowerCase()) === 0) {
				matched = true;
				break;
			}
		}

		var message = "";
		if (matched) {
			message = chrome.i18n.getMessage("autolinkExclusionsMatch");
			document.getElementById("autolinkTestExclusionResult").innerHTML = message;
			document.getElementById("autolinkTestExclusionResult").style.color = "darkgreen";
		} else {
			message = chrome.i18n.getMessage("autolinkExclusionsNoMatch");
			document.getElementById("autolinkTestExclusionResult").innerHTML = message;
			document.getElementById("autolinkTestExclusionResult").style.color = "black";
		}
	});
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("optionsTitle");
	document.title = message;

	var messageIds = [
		"autolinkExclusionsInfoText",
		"headingAutolink",
		"headingContextMenu",
		"headingCustomResolver",
		"headingHistory",
		"headingMeta",
		"headingOmnibox",
		"headingSync",
		"historyClear",
		"historyFetchTitleLabel",
		"historyNoticeText",
		"historySaveInfoText",
		"historySortByDate",
		"historySortByDoi",
		"historySortByLabel",
		"historySortBySave",
		"historySortByTitle",
		"historyTitleRefresh",
		"optionAutolink",
		"optionAutolinkApplyTo",
		"optionAutolinkExclusions",
		"optionAutolinkInfo",
		"optionAutolinkRewrite",
		"optionAutolinkTestExclusion",
		"optionContextMenu",
		"optionCrAutolink",
		"optionCrBubble",
		"optionCrContext",
		"optionCrHistory",
		"optionCrOmnibox",
		"optionCustomResolver",
		"optionCustomResolverSelection",
		"optionHistory",
		"optionHistoryLength",
		"optionHistoryShowSave",
		"optionHistoryShowTitles",
		"optionMetaButtons",
		"optionOmniboxOpento",
		"optionOmniboxOpentoCurtab",
		"optionOmniboxOpentoNewBacktab",
		"optionOmniboxOpentoNewForetab",
		"optionSyncData",
		"syncDataInfo",
		"syncDataWipeButton",
		"syncDataWipeDescription",
		"tableHeadingDelete",
		"tableHeadingDoi",
		"tableHeadingSave",
		"textDoiResolverInput",
		"textShortDoiResolverInput"
	];

	var i, elm;
	for (i = 0; i < messageIds.length; i++) {
		message = chrome.i18n.getMessage(messageIds[i]);
		elm = document.getElementById(messageIds[i]);
		if (elm.classList.contains('tooltip')) {
			elm.innerHTML = message + elm.innerHTML;
		} else {
			elm.innerHTML = message;
		}
	}

	messageIds = [
		"optionCrCustom",
		"optionCrDefault",
		"optionCrSelectable"
	];

	for (i = 0; i < messageIds.length; i++) {
		message = chrome.i18n.getMessage(messageIds[i]);
		Array.from(document.getElementsByClassName(messageIds[i])).forEach(function(elm) {
			elm.innerHTML = message;
		});
	}

	message = chrome.i18n.getMessage("resetButton");
	document.getElementById("doiResolverInputReset").innerHTML = message;
	document.getElementById("shortDoiResolverInputReset").innerHTML = message;
	message = chrome.i18n.getMessage("doiOutputUrlExample");
	document.getElementById("doiOutputUrlExample").innerHTML = message;
	document.getElementById("shortDoiOutputUrlExample").innerHTML = message;
	message = chrome.i18n.getMessage("autolinkExclusionsNoMatch");
	document.getElementById("autolinkTestExclusionResult").innerHTML = message;

	message = chrome.i18n.getMessage("svgIconCopy");
	document.querySelector("#icon-copy title").innerHTML = message;
	message = chrome.i18n.getMessage("svgIconHistory");
	document.querySelector("#icon-history title").innerHTML = message;
	message = chrome.i18n.getMessage("svgIconCog");
	document.querySelector("#icon-cog title").innerHTML = message;
	message = chrome.i18n.getMessage("svgIconInfo");
	document.querySelector("#icon-info title").innerHTML = message;

	document.getElementById("extensionVersion").innerHTML = chrome.app.getDetails().version;
}

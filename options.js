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
		if (location.hash == "#" + knownHashes[i]) {
			toggleTab(knownHashes[i]);
			break;
		}
	}
}

function toggleTab(tab) {
	Array.from(document.getElementsByClassName("content")).forEach(function(elm) {
		elm.style.display = "none";
	});
	Array.from(document.getElementsByClassName("tab")).forEach(function(elm) {
		elm.classList.remove("active");
	});
	document.getElementById(tab + "_tab").classList.add("active");
	document.getElementById("content_" + tab).style.display = "block";
	location.hash = tab;
}

function startClickListeners() {
	document.getElementById("tabs").addEventListener("click", function() {
		if(/_tab$/.test(event.target.id))
			toggleTab(event.target.id.replace(/_tab$/, ""));
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

	document.getElementById("historyClear").addEventListener("click", deleteHistory);

	$('.tooltip').tooltipster({
		theme: 'tooltipster-light',
		maxWidth: 600,
		interactive: true,
		side: ['right', 'top', 'bottom', 'left']
	});

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
	return [
		{ selector: "#history", func: saveOptions },
		{ selector: "#historyShowSave", func: saveOptions },
		{ selector: "#historyLength", func: dbHistoryLengthUpdate },
		{ selector: "#context", func: saveOptions },
		{ selector: "#meta", func: saveOptions },
		{ selector: "#autolink", func: saveOptions },
		{ selector: "#autolinkRewrite", func: saveOptions },
		{ selector: "#customResolver", func: saveOptions },
		{ selector: ".crSelections", func: saveOptions },
		{ selector: "#doiResolverInput", func: dbSaveOptions },
		{ selector: "#doiResolverInput", func: setCrPreviews },
		{ selector: "#shortDoiResolverInput", func: dbSaveOptions },
		{ selector: "#shortDoiResolverInput", func: setCrPreviews },
		{ selector: "#omniboxOpento", func: saveOptions },
		{ selector: "#autolinkApplyTo", func: saveOptions },
		{ selector: "#autolinkExclusions", func: dbSaveOptions },
		{ selector: "#autolinkTestExclusion", func: autolinkTestExclusion },
		{ selector: "#syncData", func: toggleSync }
	];
}

function startChangeListeners() {
	getSaveMap().forEach(function(map) {
		Array.from(document.querySelectorAll(map.selector)).forEach(function(elm) {
			elm.addEventListener("change", map.func);
		});
	});
}

function haltChangeListeners() {
	getSaveMap().forEach(function(map) {
		Array.from(document.querySelectorAll(map.selector)).forEach(function(elm) {
			elm.removeEventListener("change", map.func);
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

var dbSaveOptions = _.debounce(saveOptions, 750);
function saveOptions() {
	minimalOptionsRefresh();

	var options = {
		auto_link_rewrite: document.getElementById("autolinkRewrite").checked,
		autolink_exclusions: document.getElementById("autolinkExclusions").value.split("\n").filter(Boolean),
		history: document.getElementById("history").checked,
		history_showsave: document.getElementById("historyShowSave").checked,
		history_length: Number(document.getElementById("historyLength").value),
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
		"history_showsave",
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
		document.getElementById("history_tab").style.display = stg.history ? "inline-block" : "none";
		document.getElementById("historyShowSave").checked = stg.history_showsave;
		document.getElementById("historyLength").value = stg.history_length;
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
	var history = document.getElementById("history").checked;
	var customResolver = document.getElementById("customResolver").checked;
	var crAutolink = document.getElementById("crAutolink").value;

	document.getElementById("history_tab").style.display = history ? "inline-block" : "none";

	if (customResolver) {
		setCrPreviews();
	}

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
		 *
		 * Checking history_length and/or history_showsave would be redundant
		 * since recorded_dois will incorporate these changes
		 */
		var changeHistory = (typeof changes.recorded_dois !== "undefined");
		var changeHistoryLinks = historyLinksNeedUpdate(changes);
		if (changeHistory && changeHistoryLinks) {
			updateHistory(changes.recorded_dois, regenerateHistoryLinks);
		} else if (changeHistory) {
			updateHistory(changes.recorded_dois, null);
		} else if (changeHistoryLinks) {
			regenerateHistoryLinks();
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

/* ToDo: This is overzealous. Could be updated to return true only if an
 * update really is required. Would require evaluating quite a lot of
 * change combinations, though.
 */
function historyLinksNeedUpdate(changes) {
	var changeCrHistory = (typeof changes.cr_history !== "undefined");
	var changeUrlPrefix = (typeof changes.doi_resolver !== "undefined" ||
						   typeof changes.shortdoi_resolver !== "undefined");
	var changeCrEnable = (typeof changes.custom_resolver !== "undefined");

	return (changeCrHistory || changeUrlPrefix || changeCrEnable);
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

	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		removeAllHistoryEntries();

		// Skip holes in the array (should not occur)
		stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
			// Use !=, not !==, so that null is caught as well
			return elm != undefined;
		});

		var historySeparator = document.getElementById("historySeparator");
		var i, historyEntry;
		for (i = 0; i < stg.recorded_dois.length; i++) {
			if (!stg.recorded_dois[i].save) {
				historyEntry = generateHistoryEntry(stg.recorded_dois[i], i);
				historySeparator.parentNode.insertBefore(historyEntry, historySeparator.nextSibling);
			}
		}
		for (i = 0; i < stg.recorded_dois.length; i++) {
			if (stg.recorded_dois[i].save) {
				historyEntry = generateHistoryEntry(stg.recorded_dois[i], i);
				historySeparator.parentNode.insertBefore(historyEntry, historySeparator.nextSibling);
			}
		}

		startHistoryChangeListeners();
	});
}

function generateHistoryEntry(doiObject, doiId) {
	var tr = document.createElement("tr");
	tr.setAttribute("class", "history_entry");
	tr.setAttribute("id", "history_entry_" + doiId);

	var save = document.createElement("td");
	save.setAttribute("class", "history_entry_save");
	var saveCheckbox = document.createElement("input");
	saveCheckbox.setAttribute("class", "history_input_save");
	saveCheckbox.setAttribute("type", "checkbox");
	saveCheckbox.setAttribute("id", "save_entry_" + doiId);
	saveCheckbox.checked = doiObject.save;
	save.appendChild(saveCheckbox);

	var trash = document.createElement("td");
	trash.setAttribute("class", "history_entry_delete");
	var trashButton = document.createElement("button");
	trashButton.setAttribute("class", "history_input_delete");
	trashButton.setAttribute("id", "delete_entry_" + doiId);
	trashButton.innerHTML = "&#10006;";
	trash.appendChild(trashButton);

	var anchor = document.createElement("td");
	anchor.setAttribute("class", "history_entry_doi");
	anchor.setAttribute("colspan", "2");
	var anchorLink = document.createElement("a");
	anchorLink.setAttribute("href", getHistoryUrl(doiObject.doi));
	anchorLink.setAttribute("target", "_blank");
	anchorLink.innerHTML = doiObject.doi;
	anchor.appendChild(anchorLink);

	tr.appendChild(save);
	tr.appendChild(trash);
	tr.appendChild(anchor);

	return tr;
}

function saveHistoryEntry() {
	var id = Number(this.id.substr("save_entry_".length));

	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		stg.recorded_dois[id].save = document.getElementById("save_entry_" + id).checked;
		chrome.storage.local.set(stg, null);
	});
}

function deleteHistoryEntry() {
	var id = Number(this.id.substr("delete_entry_".length));

	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		stg.recorded_dois.splice(id, 1);
		document.getElementById("history_entry_" + id).classList.add("fadeOut");
		setTimeout(function() {
			chrome.storage.local.set(stg, null);
		}, 300); // 300ms matches opacity transition in css
	});
}

var dbHistoryLengthUpdate = _.debounce(historyLengthUpdate, 750);
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

function updateHistory(changes, callback) {
	var oldRecords = changes.oldValue;
	var oldLength = changes.oldValue.length;
	var newRecords = changes.newValue;
	var newLength = changes.newValue.length;
	var i, newHistoryEntry, oldHistoryEntry;

	var historySeparator = document.getElementById("historySeparator");
	haltHistoryChangeListeners();

	if (!Array.isArray(newRecords)) {
		// Should not get here
		removeAllHistoryEntries();
		chrome.storage.local.set({recorded_dois: []}, null);
		return;
	} else if (newLength === 0) {
		removeAllHistoryEntries();
	} else if (!Array.isArray(oldRecords)) {
		removeAllHistoryEntries();
		for (i = 0; i < newLength; i++) {
			newHistoryEntry = generateHistoryEntry(newRecords[i], i);
			historySeparator.parentNode.insertBefore(newHistoryEntry, historySeparator.nextSibling);
		}
		if (typeof callback === "function") {
			callback();
		}
	} else {
		for (i = 0; i < oldLength; i++) {
			if (i < newLength && !_.isEqual(oldRecords[i], newRecords[i])) {
				newHistoryEntry = generateHistoryEntry(newRecords[i], i);
				oldHistoryEntry = document.getElementById("history_entry_" + i);
				oldHistoryEntry.parentNode.insertBefore(newHistoryEntry, oldHistoryEntry);
				oldHistoryEntry.parentNode.removeChild(oldHistoryEntry);
			} else if (i >= newLength) {
				oldHistoryEntry = document.getElementById("history_entry_" + i);
				oldHistoryEntry.parentNode.removeChild(oldHistoryEntry);
			}
		}
		for (; i < newLength; i++) {
			newHistoryEntry = generateHistoryEntry(newRecords[i], i);
			historySeparator.parentNode.insertBefore(newHistoryEntry, historySeparator.nextSibling);
		}

		if (typeof callback === "function") {
			callback();
		}
	}

	startHistoryChangeListeners();
}

function deleteHistory() {
	chrome.storage.local.set({recorded_dois: []}, null);
}

function regenerateHistoryLinks() {
	Array.from(document.querySelectorAll(".history_entry .history_entry_doi a")).forEach(function(elm) {
		elm.setAttribute("href", getHistoryUrl(elm.innerHTML));
	});
}

function verifyAutolinkPermission(callback) {
	chrome.permissions.contains({
		permissions: [ "tabs" ],
		origins: [ "http://*/*", "https://*/*" ]
	}, function(result) {
		if (result) {
			autolinkDisplayUpdate(true, "httphttps");
			callback();
		} else {
			chrome.permissions.contains({
				permissions: [ "tabs" ],
				origins: [ "http://*/*" ]
			}, function(result) {
				if (result) {
					autolinkDisplayUpdate(true, "http");
					callback();
				} else {
					chrome.permissions.contains({
						permissions: [ "tabs" ],
						origins: [ "https://*/*" ]
					}, function(result) {
						if (result) {
							autolinkDisplayUpdate(true, "https");
							callback();
						} else {
							autolinkDisplayUpdate(false, null);
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
		"historySaveInfoText",
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

	var i;
	for (i = 0; i < messageIds.length; i++) {
		message = chrome.i18n.getMessage(messageIds[i]);
		document.getElementById(messageIds[i]).innerHTML = message;
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

	document.getElementById("extensionVersion").innerHTML = chrome.app.getDetails().version;
}

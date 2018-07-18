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
	beginInit();
}, false);

chrome.runtime.onMessage.addListener(function(request) {
	switch (request.cmd) {
	case "settings_updated":
		settingsUpdatedHandler(request.data, request.force_update);
		break;
	default:
		break;
	}
});

function beginInit() {
	getLocalMessages();
	restoreHashPage();
	startClickListeners();
	restoreOptions(populateHistory);
}

function restoreHashPage() {
	var knownHashes = [
		"options",
		"history",
		"about"
	];

	for (var i = 0; i < knownHashes.length; i++) {
		if (location.hash === "#" + knownHashes[i]) {
			document.getElementById(knownHashes[i] + "_tab").checked = true;
			return;
		}
	}

	// Invalid hash
	location.hash = '';
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

	document.getElementById("historyTitleRefresh").addEventListener("click", populateMissingTitles);
	document.getElementById("historyClear").addEventListener("click", deleteHistory);

	document.getElementById("syncDataWipeButton").addEventListener("click", function() {
		document.getElementById("syncData").checked = false;
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
		{ selector: "#autolink", func: setAutolink, events: ['change'] },
		{ selector: "#autolinkRewrite", func: saveOptions, events: ['change'] },
		{ selector: "#customResolver", func: saveOptions, events: ['change'] },
		{ selector: ".crSelections", func: saveOptions, events: ['change'] },
		{ selector: "#doiResolverInput", func: dbSaveOptions, events: ['input', 'change'] },
		{ selector: "#doiResolverInput", func: setCrPreviews, events: ['input', 'change'] },
		{ selector: "#shortDoiResolverInput", func: dbSaveOptions, events: ['input', 'change'] },
		{ selector: "#shortDoiResolverInput", func: setCrPreviews, events: ['input', 'change'] },
		{ selector: "#omniboxOpento", func: saveOptions, events: ['change'] },
		{ selector: "#autolinkExclusions", func: dbSaveOptions, events: ['input', 'change'] },
		{ selector: "#autolinkExclusions", func: autolinkOutputTestResults, events: ['input', 'change'] },
		{ selector: "#autolinkTestExclusion", func: autolinkOutputTestResults, events: ['input', 'change'] },
		{ selector: "#syncData", func: saveOptions, events: ['change'] }
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

function saveIndividualOptions(options, callback) {
	storageListener(false);
	chrome.storage.local.set(options, function() {
		if (typeof callback === 'function') {
			callback();
		}
	});
}

function saveOptions() {
	optionsDisplayUpdates();

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
		omnibox_tab: document.getElementById("omniboxOpento").value,
		sync_data: document.getElementById("syncData").checked
	};

	/* If history is disabled, remove all history entries */
	if (!options.history) {
		options.recorded_dois = [];
		haltHistoryChangeListeners();
		removeAllHistoryEntries();
	}

	saveIndividualOptions(options, null);
}

function restoreOptions(callback) {
	haltChangeListeners();

	var stgFetch = [
		"auto_link",
		"auto_link_rewrite",
		"autolink_exclusions",
		"context_menu",
		"cr_autolink",
		"cr_bubble",
		"cr_context",
		"cr_history",
		"cr_omnibox",
		"custom_resolver",
		"doi_resolver",
		"history",
		"history_fetch_title",
		"history_length",
		"history_showsave",
		"history_showtitles",
		"history_sortby",
		"meta_buttons",
		"omnibox_tab",
		"shortdoi_resolver",
		"sync_data"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
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
		document.getElementById("syncData").checked = stg.sync_data;
		document.getElementById("crAutolink").value = stg.cr_autolink;
		document.getElementById("crBubble").value = stg.cr_bubble;
		document.getElementById("crContext").value = stg.cr_context;
		document.getElementById("crHistory").value = stg.cr_history;
		document.getElementById("crOmnibox").value = stg.cr_omnibox;
		document.getElementById("omniboxOpento").value = stg.omnibox_tab;
		document.getElementById("autolink").checked = stg.auto_link;
		document.getElementById("autolinkRewrite").checked = stg.auto_link_rewrite;

		var autolinkExclusions = Array.isArray(stg.autolink_exclusions) ? stg.autolink_exclusions : [];
		document.getElementById("autolinkExclusions").value = autolinkExclusions.join("\n");

		optionsDisplayUpdates();
		startChangeListeners();
		storageListener(true);

		if (typeof callback === "function") {
			callback();
		}
	});
}

function optionsDisplayUpdates() {
	var customResolver = document.getElementById("customResolver").checked;
	if (customResolver) {
		setCrPreviews();
	}

	var history = document.getElementById("history").checked;
	document.getElementById("historyNotice").style.display = history ? "none" : "";

	var autolink = document.getElementById("autolink").checked;
	document.getElementById("alExclusions").style.display = autolink ? "" : "none";

	var crAutolink = document.getElementById("crAutolink").value;
	var showAlRewriteLinks = autolink && customResolver && crAutolink === "custom";
	document.getElementById("alRewriteLinks").style.display = showAlRewriteLinks ? "" : "none";
}

function storageListener(enable) {
	storageListener.status = Boolean(enable);
}

function settingsUpdatedHandler(updatedOptions, forceUpdate) {
	if (!storageListener.status && !forceUpdate) {
		storageListener(true);
		return;
	}

	console.log("Storage changed, checking for updates");

	if (Object.keys(updatedOptions).length === 0) {
		console.log("Nothing to update");
		return;
	}

	if (updatedOptions.autolink_exclusions !== undefined) {
		autolinkOutputTestResults();
	}

	var i;

	var allOptionsInPage = [
		"auto_link_rewrite",
		"autolink_exclusions",
		"context_menu",
		"cr_autolink",
		"cr_bubble",
		"cr_context",
		"cr_history",
		"cr_omnibox",
		"custom_resolver",
		"doi_resolver",
		"history",
		"history_fetch_title",
		"history_length",
		"history_showsave",
		"history_showtitles",
		"history_sortby",
		"meta_buttons",
		"omnibox_tab",
		"shortdoi_resolver",
		"sync_data"
	];

	var optionsUpdated = false;
	for (i = 0; i < allOptionsInPage.length; i++) {
		if (updatedOptions[allOptionsInPage[i]] !== undefined) {
			optionsUpdated = true;
			break;
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

	var historyUpdated = false;
	for (i = 0; i < historyRefreshOptions.length; i++) {
		if (updatedOptions[historyRefreshOptions[i]] !== undefined) {
			historyUpdated = true;
			break;
		}
	}

	if (optionsUpdated && historyUpdated) {
		console.log("Options and history updated");
		restoreOptions(populateHistory);
	} else if (optionsUpdated) {
		console.log("Options updated");
		restoreOptions(null);
	} else if (historyUpdated) {
		console.log("History updated");
		populateHistory();
	} else {
		console.log("No relevant updates found");
	}

	storageListener(true);
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

function autolinkOutputTestResults() {
	var message;
	var autolinkTestExclusion = document.getElementById('autolinkTestExclusion');
	var autolinkTestExclusionResult = document.getElementById("autolinkTestExclusionResult");
	if (!/https?:\/\//i.test(autolinkTestExclusion.value)) {
		message = chrome.i18n.getMessage("autolinkExclusionsInvalidUrl");
		autolinkTestExclusionResult.innerHTML = message;
		return;
	}

	chrome.extension.getBackgroundPage().autolinkTestExclusions(autolinkTestExclusion.value)
	.then((matched) => {
		if (matched) {
			message = chrome.i18n.getMessage("autolinkExclusionsMatch");
			autolinkTestExclusionResult.innerHTML = message;
			autolinkTestExclusionResult.style.color = "darkgreen";
		} else {
			message = chrome.i18n.getMessage("autolinkExclusionsNoMatch");
			autolinkTestExclusionResult.innerHTML = message;
			autolinkTestExclusionResult.style.color = "black";
		}
	});
}

/*
 * settingsUpdatedHandler ignores the auto_link setting in storage, so it's
 * safe to update it in the background (via autolinkDois) without worry of
 * triggering the change handler. The checkbox change handler does need to
 * be disabled, though, as we may end up programmatically setting the check
 * state if permissions are not accepted.
 */
function setAutolink() {
	var autolinkElm = document.getElementById("autolink");
	haltChangeListeners();

	if (autolinkElm.checked) {
		chrome.permissions.request({
			permissions: [ "tabs" ],
			origins: [ "http://*/*", "https://*/*" ]
		}, function(granted) {
			if (granted) {
				console.log("Autolink permissions added");
				chrome.extension.getBackgroundPage().autolinkDois()
				.then((result) => {
					// Result is pretty much guaranteed, no need to verify
					optionsDisplayUpdates();
					startChangeListeners();
				});
			} else {
				console.log("Autolink permissions not granted");
				autolinkElm.checked = false;
				startChangeListeners();
			}
		});
	} else {
		chrome.permissions.remove({
			permissions: [ "tabs" ],
			origins: [ "http://*/*", "https://*/*" ]
		}, function(removed) {
			if (removed) {
				console.log("Autolink permissions removed");
				chrome.extension.getBackgroundPage().autolinkDois()
				.then((result) => {
					// Result is pretty much guaranteed, no need to verify
					optionsDisplayUpdates();
					startChangeListeners();
				});
			} else {
				console.log("Autolink permissions could not be removed");
				chrome.extension.getBackgroundPage().autolinkToggleListener(false);
				console.log("Autolink listeners manually disabled");
				chrome.storage.local.set({ auto_link: false }, function() {
					startChangeListeners();
				});
			}
		});
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

	chrome.storage.local.get(["recorded_dois", "history_sortby"], function(stg) {
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
	chrome.storage.local.get(["recorded_dois"], function(stg) {
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

		var setDoiMetaPermissions = chrome.extension.getBackgroundPage().setDoiMetaPermissions;

		setDoiMetaPermissions(true)
		.then(function(granted) {
			if (!granted) {
				return reject("Origin permissions not granted");
			}

			var gatherFetchResults = function(promises) {
				Promise.all(promises)
				.then(function(results) {
					setDoiMetaPermissions(false);
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
	var checked = historyFetchTitle.checked;
	var setDoiMetaPermissions = chrome.extension.getBackgroundPage().setDoiMetaPermissions;

	setDoiMetaPermissions(checked)
	.then(function(success) {
		if (checked && success) {
			saveOptions();
		} else if (checked && !success) {
			historyFetchTitle.checked = false;
		} else if (!checked) {
			// Do not forcibly re-check box if permissions are not successfully removed
			saveOptions();
		}
	});
}

function saveHistoryTitles(doiTitleReference) {
	return new Promise(function(resolve) {

		if (!doiTitleReference || Object.keys(doiTitleReference).length === 0) {
			return;
		}

		chrome.storage.local.get(["recorded_dois"], function(stg) {
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
				saveIndividualOptions(stg, resolve);
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

	chrome.storage.local.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		var index = stg.recorded_dois.findIndex(function(item) {
			return item.doi === doi;
		});

		stg.recorded_dois[index].save = save;
		saveIndividualOptions(stg, null);
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

	chrome.storage.local.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		var index = stg.recorded_dois.findIndex(function(item) {
			return item.doi === doi;
		});

		stg.recorded_dois.splice(index, 1);
		entryElm.classList.add("fadeOut");
		setTimeout(function() {
			saveIndividualOptions(stg, null);
		}, 300); // 300ms matches opacity transition in css
	});
}

function historyLengthUpdate() {
	var historyLength = Number(document.getElementById("historyLength").value);
	if (isNaN(historyLength) || historyLength < 1) {
		document.getElementById("historyLength").value = 1;
	} else if (historyLength > 1000) {
		document.getElementById("historyLength").value = 1000;
	}

	chrome.storage.local.get(["recorded_dois"], function(stg) {
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
			saveIndividualOptions({recorded_dois: stg.recorded_dois}, saveOptions);
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
	saveIndividualOptions({recorded_dois: []}, null);
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
		"imgPreview",
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

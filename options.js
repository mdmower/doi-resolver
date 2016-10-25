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
	if (typeof storage.area === 'undefined') {
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
	var contentId = "#content_" + tab;
	var tabId = "#" + tab + "_tab";

	$(".content").css("display", "none");
	$(contentId).css("display", "block");
	$(".tab").removeClass("active");
	$(tabId).addClass("active");
	location.hash = tab;
}

function startClickListeners() {
	$("#options_tab").on("click", function() {
		toggleTab("options");
	});
	$("#history_tab").on("click", function() {
		toggleTab("history");
	});
	$("#about_tab").on("click", function() {
		toggleTab("about");
	});

	$("#doiResolverInputReset").on("click", function() {
		if ($("#doiResolverInput").val() !== "http://dx.doi.org/") {
			$("#doiResolverInput").val("http://dx.doi.org/").trigger("input").trigger("change");
		}
	});
	$("#shortDoiResolverInputReset").on("click", function() {
		if ($("#shortDoiResolverInput").val() !== "http://doi.org/") {
			$("#shortDoiResolverInput").val("http://doi.org/").trigger("input").trigger("change");
		}
	});

	$("#img_context_off").on("click", function() {
		if ($("#context").prop('checked')) {
			$("#context").prop("checked", false).trigger("change");
		}
	});
	$("#img_context_on").on("click", function() {
		if (!($("#context").prop('checked'))) {
			$("#context").prop("checked", true).trigger("change");
		}
	});

	$("#img_bubblemeta_off").on("click", function() {
		if ($("#meta").prop('checked')) {
			$("#meta").prop("checked", false).trigger("change");
		}
	});
	$("#img_bubblemeta_on").on("click", function() {
		if (!($("#meta").prop('checked'))) {
			$("#meta").prop("checked", true).trigger("change");
		}
	});

	$("#historyClear").on("click", deleteHistory);

	$('.tooltip').tooltipster({
		theme: 'tooltipster-light',
		maxWidth: 600,
		interactive: true,
		side: ['right', 'top', 'bottom', 'left']
	});

	$("#syncDataWipeButton").on("click", function() {
		$("#syncData").prop("checked", false);
		$("#syncDataWipe").css("display", "none");
		/* background listens for sync_reset == true */
		chrome.storage.sync.set({sync_reset: true}, null);
	});
}

function startChangeListeners() {
	/*
	 * doiResolverInput, shortDoiResolverInput, historyLength
	 * These can fire onChange events frequently. debounce them to only
	 * run once per 750ms so Chrome Sync doesn't get too many sync requests.
	 */

	$("#history").on("change", saveOptions);
	$("#historyShowSave").on("change", saveOptions);
	$("#historyLength").on("change", dbHistoryLengthUpdate);
	$("#context").on("change", saveOptions);
	$("#meta").on("change", saveOptions);
	$("#autolink").on("change", saveOptions);
	$("#autolinkRewrite").on("change", saveOptions);
	$("#customResolver").on("change", saveOptions);
	$(".crSelections").on("change", saveOptions);
	$("#doiResolverInput").on("change", dbSaveOptions);
	$("#doiResolverInput").on("input", setCrPreviews);
	$("#shortDoiResolverInput").on("change", dbSaveOptions);
	$("#shortDoiResolverInput").on("input", setCrPreviews);
	$("#omniboxOpento").on("change", saveOptions);
	$("#autolinkApplyTo").on("change", saveOptions);
	$("#autolinkExclusions").on("change", dbSaveOptions);
	$("#autolinkTestExclusion").on("keyup", autolinkTestExclusion);
	$("#syncData").on("change", toggleSync);
}

function haltChangeListeners() {
	$("#history").off("change", saveOptions);
	$("#historyShowSave").off("change", saveOptions);
	$("#historyLength").off("change", dbHistoryLengthUpdate);
	$("#context").off("change", saveOptions);
	$("#meta").off("change", saveOptions);
	$("#autolink").off("change", saveOptions);
	$("#autolinkRewrite").off("change", saveOptions);
	$("#customResolver").off("change", saveOptions);
	$(".crSelections").off("change", saveOptions);
	$("#doiResolverInput").off("change", dbSaveOptions);
	$("#doiResolverInput").off("input", setCrPreviews);
	$("#shortDoiResolverInput").off("change", dbSaveOptions);
	$("#shortDoiResolverInput").off("input", setCrPreviews);
	$("#omniboxOpento").off("change", saveOptions);
	$("#autolinkApplyTo").off("change", saveOptions);
	$("#autolinkExclusions").off("change", dbSaveOptions);
	$("#autolinkTestExclusion").off("keyup", autolinkTestExclusion);
	$("#syncData").off("change", toggleSync);
}

function startHistoryChangeListeners() {
	$('.history_input_save').on("change", function() {
		var arrid = parseInt(this.id.substr("save_entry_".length));
		saveHistoryEntry(arrid);
	});
	$('.history_input_delete').on("click", function() {
		var arrid = parseInt(this.id.substr("delete_entry_".length));
		deleteHistoryEntry(arrid);
	});
}

function haltHistoryChangeListeners() {
	$('.history_input_save').off("change");
	$('.history_input_delete').off("click");
}

function toggleSync() {
	var sd = $("#syncData").prop('checked');
	if (sd) {
		$("#syncDataWipe").css("display", "block");

		chrome.storage.sync.set({sync_reset: false}, function() {
			chrome.storage.local.set({sync_data: true}, function() {
				chrome.runtime.sendMessage({cmd: "toggle_sync"});
			});
		});
	} else {
		$("#syncDataWipe").css("display", "none");

		storageListener(false);
		chrome.storage.local.set({sync_data: false}, function() {
			chrome.runtime.sendMessage({cmd: "toggle_sync"});
		});
	}
}

var dbSaveOptions = _.debounce(saveOptions, 750);
function saveOptions() {
	minimalOptionsRefresh();

	var options = {
		auto_link_rewrite: $("#autolinkRewrite").prop('checked'),
		autolink_exclusions: $("#autolinkExclusions").val().split("\n").filter(Boolean),
		history: $("#history").prop('checked'),
		history_showsave: $("#historyShowSave").prop('checked'),
		history_length: parseInt($("#historyLength").val()),
		context_menu: $("#context").prop('checked'),
		meta_buttons: $("#meta").prop('checked'),
		custom_resolver: $("#customResolver").prop('checked'),
		cr_autolink: $("#crAutolink option:selected").val(),
		cr_bubble: $("#crBubble option:selected").val(),
		cr_context: $("#crContext option:selected").val(),
		cr_history: $("#crHistory option:selected").val(),
		cr_omnibox: $("#crOmnibox option:selected").val(),
		doi_resolver: $("#doiResolverInput").val(),
		shortdoi_resolver: $("#shortDoiResolverInput").val(),
		omnibox_tab: $("#omniboxOpento option:selected").val()
	};

	/* If history is disabled, remove all history entries */
	if (!options.history) {
		options.recorded_dois = [];
	}

	/*
	 * These options require permissions setting/checking. Only call them
	 * if the current setting differs from stored setting
	 */
	var autolinkCurrent = $("#autolink").prop('checked');
	var autolinkProtocolCurrent = $("#autolinkApplyTo option:selected").val();

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
		var alpOp = stgLocal.al_protocol;
		var alrOp = stg.auto_link_rewrite;
		var aleOp = Array.isArray(stg.autolink_exclusions) ? stg.autolink_exclusions : [];
		var sdOp = stgLocal.sync_data;
		var hOp = stg.history;
		var hlOp = stg.history_length;
		var hssOp = stg.history_showsave;
		var cmOp = stg.context_menu;
		var metaOp = stg.meta_buttons;
		var crOp = stg.custom_resolver;
		var craOp = stg.cr_autolink;
		var crbOp = stg.cr_bubble;
		var crcOp = stg.cr_context;
		var crhOp = stg.cr_history;
		var croOp = stg.cr_omnibox;
		var drOp = stg.doi_resolver;
		var srOp = stg.shortdoi_resolver;
		var otOp = stg.omnibox_tab;

		$("#doiResolverInput").val(drOp);
		$("#shortDoiResolverInput").val(srOp);
		$("#autolinkExclusions").val(aleOp.join('\n'));

		if (hOp === true) {
			$("#history").prop("checked", true);
			$("#history_tab").css("display", "inline-block");
			$("#historySubOptions").css("display", "block");
		} else {
			$("#history").prop("checked", false);
			$("#history_tab").css("display", "none");
			$("#historySubOptions").css("display", "none");
		}
		$("#historyShowSave").prop("checked", hssOp);
		$("#historyLength").val(hlOp);

		if (cmOp === true) {
			$("#context").prop("checked", true);
			$("#img_context_on").css("border-color", "#404040");
			$("#img_context_off").css("border-color", "white");
		} else {
			$("#context").prop("checked", false);
			$("#img_context_on").css("border-color", "white");
			$("#img_context_off").css("border-color", "#404040");
		}

		if (metaOp === true) {
			$("#meta").prop("checked", true);
			$("#img_bubblemeta_on").css("border-color", "#404040");
			$("#img_bubblemeta_off").css("border-color", "white");
		} else {
			$("#meta").prop("checked", false);
			$("#img_bubblemeta_on").css("border-color", "white");
			$("#img_bubblemeta_off").css("border-color", "#404040");
		}

		if (crOp === true) {
			$("#customResolver").prop("checked", true);
			$("#customResolverLeft").css("display", "inline-block");
			$("#customResolverRight").css("display", "inline-block");
			setCrPreviews(); // Depends on text fields being filled already
		} else {
			$("#customResolver").prop("checked", false);
			$("#customResolverLeft").css("display", "none");
			$("#customResolverRight").css("display", "none");
		}

		if (sdOp === true) {
			$("#syncData").prop("checked", true);
			$("#syncDataWipe").css("display", "block");
		} else {
			$("#syncData").prop("checked", false);
			$("#syncDataWipe").css("display", "none");
		}

		$("#crAutolink").val(craOp);
		$("#crBubble").val(crbOp);
		$("#crContext").val(crcOp);
		$("#crHistory").val(crhOp);
		$("#crOmnibox").val(croOp);
		$("#omniboxOpento").val(otOp);
		$("#autolinkApplyTo").val(alpOp);
		$("#autolinkRewrite").prop("checked", alrOp);

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
	var history = $("#history").prop('checked');
	var cm = $("#context").prop('checked');
	var meta = $("#meta").prop('checked');
	var cr = $("#customResolver").prop('checked');
	var cra = $("#crAutolink").val();

	if (history) {
		$("#history_tab").css("display", "inline-block");
		$("#historySubOptions").css("display", "block");
	} else {
		$("#history_tab").css("display", "none");
		$("#historySubOptions").css("display", "none");
	}

	if (cm) {
		$("#img_context_on").css("border-color", "#404040");
		$("#img_context_off").css("border-color", "white");
	} else {
		$("#img_context_on").css("border-color", "white");
		$("#img_context_off").css("border-color", "#404040");
	}

	if (meta) {
		$("#img_bubblemeta_on").css("border-color", "#404040");
		$("#img_bubblemeta_off").css("border-color", "white");
	} else {
		$("#img_bubblemeta_on").css("border-color", "white");
		$("#img_bubblemeta_off").css("border-color", "#404040");
	}

	if (cr) {
		$("#customResolverLeft").css("display", "inline-block");
		$("#customResolverRight").css("display", "inline-block");
		setCrPreviews();
	} else {
		$("#customResolverLeft").css("display", "none");
		$("#customResolverRight").css("display", "none");
	}

	/* There's no problem with this running async to the rest of
	 * saveOptions since a change to the autolink setting will
	 * call autolinkDisplayUpdate(). This minimal refresh is for
	 * the case of enabling custom resolver when autolink is
	 * already enabled.
	 */
	chrome.storage.local.get(["auto_link"], function(stg) {
		if (stg.auto_link === true && cr && cra == "custom") {
			$("#alRewriteLinks").css("display", "block");
		} else {
			$("#alRewriteLinks").css("display", "none");
		}
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
	if (namespace === "local") {
		/* For the purpose of updating the history page, only the local
		 * namespace needs to be monitored since: 1) local changes are
		 * written to chrome.storage.local; and 2) changes brought in by
		 * sync will be copied to chrome.storage.local in the background
		 *
		 * Checking history_length and/or history_showsave would be redundant
		 * since recorded_dois will incorporate these changes
		 */
		var changeHistory = (typeof changes.recorded_dois !== 'undefined');
		var changeHistoryLinks = historyLinksNeedUpdate(changes);
		if (changeHistory && changeHistoryLinks) {
			updateHistory(changes.recorded_dois, regenerateHistoryLinks);
		} else if (changeHistory) {
			updateHistory(changes.recorded_dois, null);
		} else if (changeHistoryLinks) {
			regenerateHistoryLinks();
		}

		if (typeof changes.autolink_exclusions !== 'undefined' && Array.isArray(changes.autolink_exclusions.newValue)) {
			autolinkTestExclusion();
		}
	}

	/* sync_reset is handled in the background page */
	if (namespace === "sync" && typeof changes.sync_reset === 'undefined') {
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
	var drInput = $("#doiResolverInput").val();
	var srInput = $("#shortDoiResolverInput").val();
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

	$("#doiResolverOutput").html(drPreview);
	$("#shortDoiResolverOutput").html(srPreview);
}

function autolinkDisplayUpdate(enabled, protocol) {
	var cr = $("#customResolver").prop('checked');
	var cra = $("#crAutolink").val();

	$("#autolink").prop("checked", enabled);

	if (protocol !== null) {
		$("#autolinkApplyTo").val(protocol);
		$("#alProtocol").css("display", "block");
		$("#alExclusions").css("display", "block");
		if (cr && cra == "custom") {
			$("#alRewriteLinks").css("display", "block");
		} else {
			$("#alRewriteLinks").css("display", "none");
		}
	} else {
		$("#alProtocol").css("display", "none");
		$("#alExclusions").css("display", "none");
		$("#alRewriteLinks").css("display", "none");
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
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*', 'https://*/*' ]
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
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*', 'https://*/*' ]
		}, function(removed) {
			if (removed) {
				autolinkDisplayUpdate(false, null);
				chrome.runtime.sendMessage({cmd: "auto_link"});
				startChangeListeners();
				console.log("Autolink permissions removed");
			} else {
				var protocol = $("#autolinkApplyTo option:selected").val();
				autolinkDisplayUpdate(true, protocol);
				chrome.runtime.sendMessage({cmd: "auto_link"});
				startChangeListeners();
				console.log("Could not remove autolink permissions");
			}
		});
	}
}

function autolinkShufflePerms() {
	// Only called if permissions have been granted by user
	var protocol = $("#autolinkApplyTo option:selected").val();

	if (protocol === "http") {
		chrome.permissions.remove({
			origins: [ 'https://*/*' ]
		}, function(removed) {
			chrome.runtime.sendMessage({cmd: "auto_link"});
			verifyAutolinkPermission(startChangeListeners);
		});
	} else if (protocol === "https") {
		chrome.permissions.remove({
			origins: [ 'http://*/*' ]
		}, function(removed) {
			chrome.runtime.sendMessage({cmd: "auto_link"});
			verifyAutolinkPermission(startChangeListeners);
		});
	} else {
		chrome.runtime.sendMessage({cmd: "auto_link"});
		verifyAutolinkPermission(startChangeListeners);
	}
}

/* ToDo: This is overzealous. Could be updated to return true only if an
 * update really is required. Would require evaluating quite a lot of
 * change combinations, though.
 */
function historyLinksNeedUpdate(changes) {
	var changeCrHistory = (typeof changes.cr_history !== 'undefined');
	var changeUrlPrefix = (typeof changes.doi_resolver !== 'undefined' ||
						   typeof changes.shortdoi_resolver !== 'undefined');
	var changeCrEnable = (typeof changes.custom_resolver !== 'undefined');

	return (changeCrHistory || changeUrlPrefix || changeCrEnable);
}

function getHistoryUrl(doi) {
	var cr = $("#customResolver").prop('checked');
	var crh = $("#crHistory option:selected").val();
	var dr = $("#doiResolverInput").val();
	var sr = $("#shortDoiResolverInput").val();
	var url = "";

	if (cr && crh === "custom") {
		if (/^10\./.test(doi)) {
			url = dr + doi;
		} else if (/^10\//.test(doi)) {
			url = sr + doi.replace(/^10\//,"");
		}
	} else {
		if (/^10\./.test(doi)) {
			url = "http://dx.doi.org/" + doi;
		} else if (/^10\//.test(doi)) {
			url = "http://doi.org/" + doi.replace(/^10\//,"");
		}
	}

	return url;
}

function populateHistory() {
	if (!$("#history").prop('checked')) {
		return;
	}

	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		$(".history_entry").remove();

		// Skip holes in the array (should not occur)
		stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
			// Use !=, not !==, so that null is caught as well
			return elm != undefined;
		});

		var i;
		for (i = 0; i < stg.recorded_dois.length; i++) {
			if (!stg.recorded_dois[i].save) {
				$("#historySeparator").after(generateHistoryEntry(stg.recorded_dois[i], i));
			}
		}
		for (i = 0; i < stg.recorded_dois.length; i++) {
			if (stg.recorded_dois[i].save) {
				$("#historySeparator").after(generateHistoryEntry(stg.recorded_dois[i], i));
			}
		}

		startHistoryChangeListeners();
	});
}

function generateHistoryEntry(doiObject, doiId) {
	var tr = $('<tr>');
	tr.addClass('history_entry');
	tr.attr({id: "history_entry_" + doiId});

	var save = $('<td>');
	save.addClass('history_entry_save');
	var saveCheckbox = $('<input/>');
	saveCheckbox.addClass('history_input_save');
	saveCheckbox.attr({type: "checkbox", id: "save_entry_" + doiId});
	saveCheckbox.prop("checked", doiObject.save);
	save.append([saveCheckbox]);

	var trash = $('<td>');
	trash.addClass('history_entry_delete');
	var trashButton = $('<button>').html("&#10006;");
	trashButton.addClass('history_input_delete');
	trashButton.attr({id: "delete_entry_" + doiId});
	trash.append([trashButton]);

	var anchor = $('<td>');
	anchor.addClass("history_entry_doi");
	anchor.attr({colspan: '2'});
	var anchorLink = $('<a>');
	anchorLink.attr({href: getHistoryUrl(doiObject.doi), target: '_blank'});
	anchorLink.html(doiObject.doi);
	anchor.append([anchorLink]);

	return tr.append([save, trash, anchor]);
}

function saveHistoryEntry(id) {
	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		stg.recorded_dois[id].save = $("#save_entry_" + id).prop("checked");
		chrome.storage.local.set(stg, null);
	});
}

function deleteHistoryEntry(id) {
	storage.area.get(["recorded_dois"], function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		stg.recorded_dois.splice(id, 1);
		$("#history_entry_" + id).fadeOut(function() {
			chrome.storage.local.set(stg, null);
		});
	});
}

var dbHistoryLengthUpdate = _.debounce(historyLengthUpdate, 750);
function historyLengthUpdate() {
	var historyLength = parseInt($("#historyLength").val());
	if (isNaN(historyLength) || historyLength < 1) {
		$("#historyLength").val(1);
	} else if (historyLength > 500) {
		$("#historyLength").val(500);
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

function updateHistory(changes, callback) {
	var oldRecords = changes.oldValue;
	var oldLength = changes.oldValue.length;
	var newRecords = changes.newValue;
	var newLength = changes.newValue.length;
	var i;

	haltHistoryChangeListeners();

	if (!Array.isArray(newRecords)) {
		// Should not get here
		$(".history_entry").remove();
		chrome.storage.local.set({recorded_dois: []}, null);
		return;
	} else if (newLength === 0) {
		$(".history_entry").remove();
	} else if (!Array.isArray(oldRecords)) {
		$(".history_entry").remove();
		for (i = 0; i < newLength; i++) {
			$("#historySeparator").after(generateHistoryEntry(newRecords[i], i));
		}
		if (typeof callback === "function") {
			callback();
		}
	} else {
		for (i = 0; i < oldLength; i++) {
			if (i < newLength && !_.isEqual(oldRecords[i], newRecords[i])) {
				$("#history_entry_" + i).replaceWith(generateHistoryEntry(newRecords[i], i));
			} else if (i >= newLength) {
				$("#history_entry_" + i).remove();
			}
		}
		for (; i < newLength; i++) {
			$("#historySeparator").after(generateHistoryEntry(newRecords[i], i));
		}

		// Should not be needed, but ensures stray entries from the history
		// page are removed if they no longer have references in newRecords
		for (i = newLength; i < $(".history_entry").length; i++) {
			$("#history_entry_" + i).remove();
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
	$(".history_entry .history_entry_doi a").each(function(index) {
		$(this).attr({href: getHistoryUrl($(this).html())});
	});
}

function verifyAutolinkPermission(callback) {
	chrome.permissions.contains({
		permissions: [ 'tabs' ],
		origins: [ 'http://*/*', 'https://*/*' ]
	}, function(result) {
		if (result) {
			autolinkDisplayUpdate(true, "httphttps");
			callback();
		} else {
			chrome.permissions.contains({
				permissions: [ 'tabs' ],
				origins: [ 'http://*/*' ]
			}, function(result) {
				if (result) {
					autolinkDisplayUpdate(true, "http");
					callback();
				} else {
					chrome.permissions.contains({
						permissions: [ 'tabs' ],
						origins: [ 'https://*/*' ]
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

		var url = encodeURI($("#autolinkTestExclusion").val()).replace(/^https?\:\/\//i, "").toLowerCase();
		var exclusion = "";
		var re;
		var matched = false;
		for (var i = 0; i < stg.autolink_exclusions.length; i++) {
			exclusion = stg.autolink_exclusions[i];
			if (exclusion.slice(-1) === '/' && exclusion.charAt(0) === '/') {
				try {
					re = new RegExp(exclusion.slice(1, -1), 'i');
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
			$("#autolinkTestExclusionResult").html(message);
			$("#autolinkTestExclusionResult").css({color: "darkgreen"});
		} else {
			message = chrome.i18n.getMessage("autolinkExclusionsNoMatch");
			$("#autolinkTestExclusionResult").html(message);
			$("#autolinkTestExclusionResult").css({color: "black"});
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
		"optionsTitle",
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
		$('#' + messageIds[i]).html(message);
	}

	messageIds = [
		"optionCrCustom",
		"optionCrDefault",
		"optionCrSelectable"
	];

	for (i = 0; i < messageIds.length; i++) {
		message = chrome.i18n.getMessage(messageIds[i]);
		$('.' + messageIds[i]).html(message);
	}

	message = chrome.i18n.getMessage("resetButton");
	$("#doiResolverInputReset").html(message);
	$("#shortDoiResolverInputReset").html(message);
	message = chrome.i18n.getMessage("doiOutputUrlExample");
	$("#doiOutputUrlExample").html(message);
	$("#shortDoiOutputUrlExample").html(message);
	message = chrome.i18n.getMessage("autolinkExclusionsNoMatch");
	$("#autolinkTestExclusionResult").html(message);

	$("#extensionVersion").html(chrome.app.getDetails().version);
}

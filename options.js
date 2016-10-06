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
	switch(request.cmd) {
		case "sync_toggle_complete":
			storage(false, true);
			break;
		case "settings_dup_complete":
			storage(false, false);
			break;
		case "auto_link_config_complete":
			// Do nothing
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
		if(stg["sync_data"] === true) {
			storage.area = chrome.storage.sync;
			storageListener(true);
		} else {
			storage.area = chrome.storage.local;
			storageListener(false);
		}

		if(firstRun === true) {
			continueOnLoad();
		}
		if(restore === true) {
			restoreOptions();
		}
	});
}

function continueOnLoad() {
	getLocalMessages();
	startClickListeners();
	chrome.storage.onChanged.addListener(storageChangeHandler);
}

function startClickListeners() {
	$("#options_tab").on("click", function() {
		$("#content_options").css("display", "block");
		$("#content_about").css("display", "none");
	});
	$("#about_tab").on("click", function() {
		$("#content_options").css("display", "none");
		$("#content_about").css("display", "block");
	});

	$("#doiResolverInputReset").on("click", function() {
		if($("#doiResolverInput").val() !== "http://dx.doi.org/") {
			$("#doiResolverInput").val("http://dx.doi.org/").trigger("input").trigger("change");
		}
	});
	$("#shortDoiResolverInputReset").on("click", function() {
		if($("#shortDoiResolverInput").val() !== "http://doi.org/") {
			$("#shortDoiResolverInput").val("http://doi.org/").trigger("input").trigger("change");
		}
	});

	$("#img_context_off").on("click", function() {
		if($("#context").prop('checked')) {
			$("#context").prop("checked", false).trigger("change");
		}
	});
	$("#img_context_on").on("click", function() {
		if(!($("#context").prop('checked'))) {
			$("#context").prop("checked", true).trigger("change");
		}
	});

	$("#img_bubblemeta_off").on("click", function() {
		if($("#meta").prop('checked')) {
			$("#meta").prop("checked", false).trigger("change");
		}
	});
	$("#img_bubblemeta_on").on("click", function() {
		if(!($("#meta").prop('checked'))) {
			$("#meta").prop("checked", true).trigger("change");
		}
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
	 * doiResolverInput and shortDoiResolverInput can fire onChange events
	 * frequently. debounce them to only run once per 750ms so Chrome Sync
	 * doesn't get too many sync requests.
	 */
	var dbSaveOptions = _.debounce(saveOptions, 750);

	$("#context").on("change", saveOptions);
	$("#meta").on("change", saveOptions);
	$("#autoLink").on("change", saveOptions);
	$("#autoLinkRewrite").on("change", saveOptions);
	$("#customResolver").on("change", saveOptions);
	$(".crSelections").on("change", saveOptions);
	$("#doiResolverInput").on("change", dbSaveOptions);
	$("#doiResolverInput").on("input", setCrPreviews);
	$("#shortDoiResolverInput").on("change", dbSaveOptions);
	$("#shortDoiResolverInput").on("input", setCrPreviews);
	$("#omniboxOpento").on("change", saveOptions);
	$("#autolinkApplyto").on("change", saveOptions);
	$("#syncData").on("change", toggleSync);
}

function haltChangeListeners() {
	var dbSaveOptions = _.debounce(saveOptions, 750);

	$("#context").off("change", saveOptions);
	$("#meta").off("change", saveOptions);
	$("#autoLink").off("change", saveOptions);
	$("#autoLinkRewrite").off("change", saveOptions);
	$("#customResolver").off("change", saveOptions);
	$(".crSelections").off("change", saveOptions);
	$("#doiResolverInput").off("change", dbSaveOptions);
	$("#doiResolverInput").off("input", setCrPreviews);
	$("#shortDoiResolverInput").off("change", dbSaveOptions);
	$("#shortDoiResolverInput").off("input", setCrPreviews);
	$("#omniboxOpento").off("change", saveOptions);
	$("#autolinkApplyto").off("change", saveOptions);
	$("#syncData").off("change", toggleSync);
}

function toggleSync() {
	var sd = $("#syncData").prop('checked');
	if(sd) {
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

function saveOptions() {
	minimalOptionsRefresh();

	var options = {
		auto_link_rewrite: $("#autoLinkRewrite").prop('checked'),
		context_menu: $("#context").prop('checked'),
		meta_buttons: $("#meta").prop('checked'),
		custom_resolver: $("#customResolver").prop('checked'),
		cr_autolink: $("#crAutolink option:selected").val(),
		cr_bubble: $("#crBubble option:selected").val(),
		cr_context: $("#crContext option:selected").val(),
		cr_omnibox: $("#crOmnibox option:selected").val(),
		doi_resolver: $("#doiResolverInput").val(),
		shortdoi_resolver: $("#shortDoiResolverInput").val(),
		omnibox_tab: $("#omniboxOpento option:selected").val()
	}

	/*
	 * These options require permissions setting/checking. Only call them
	 * if the current setting differs from stored setting
	 */
	var alCur = $("#autoLink").prop('checked');
	var alrCur = $("#autoLinkRewrite").prop('checked');
	var alpCur = $("#autolinkApplyto option:selected").val();

	var stgLclFetch = [
		"auto_link",
		"auto_link_rewrite",
		"al_protocol"		
	];

	chrome.storage.local.get(stgLclFetch, function(stgLocal) {
		var alBool = stgLocal["auto_link"];
		var alrBool = stgLocal["auto_link_rewrite"];
		var alpStr = stgLocal["al_protocol"];

		storageListener(false);
		if(alCur != alBool || alpCur != alpStr) {
			chrome.storage.local.set(options, setAutolinkPermission);
		} else {
			if(alBool && (alrBool!=alrCur)){ // auto link rewrite was changed and has effect
				chrome.runtime.sendMessage({cmd: "auto_link"});
			}
			/* Wait for message confirming .local to .sync duplication
			 * is complete in background before re-enabling storage
			 * listener here
			 */
			chrome.storage.local.set(options, null);
		}
	});
}

function restoreOptions() {
	haltChangeListeners();

	var stgLclFetch = [
		"al_protocol",
		"sync_data"
	];

	var stgFetch = stgFetch = [
		"auto_link_rewrite",
		"context_menu",
		"meta_buttons",
		"custom_resolver",
		"cr_autolink",
		"cr_bubble",
		"cr_context",
		"cr_omnibox",
		"doi_resolver",
		"shortdoi_resolver",
		"omnibox_tab"
	];

	chrome.storage.local.get(stgLclFetch, function(stgLocal) {
	storage.area.get(stgFetch, function(stg) {
		var alpOp = stgLocal["al_protocol"];
		var alrOp = stg["auto_link_rewrite"];
		var sdOp = stgLocal["sync_data"];
		var cmOp = stg["context_menu"];
		var metaOp = stg["meta_buttons"];
		var crOp = stg["custom_resolver"];
		var craOp = stg["cr_autolink"];
		var crbOp = stg["cr_bubble"];
		var crcOp = stg["cr_context"];
		var croOp = stg["cr_omnibox"];
		var drOp = stg["doi_resolver"];
		var srOp = stg["shortdoi_resolver"];
		var otOp = stg["omnibox_tab"];

		$("#doiResolverInput").val(drOp);
		$("#shortDoiResolverInput").val(srOp);

		if(cmOp === true) {
			$("#context").prop("checked", true);
			$("#img_context_on").css("border-color", "#404040");
			$("#img_context_off").css("border-color", "white");
		} else {
			$("#context").prop("checked", false);
			$("#img_context_on").css("border-color", "white");
			$("#img_context_off").css("border-color", "#404040");
		}

		if(metaOp === true) {
			$("#meta").prop("checked", true);
			$("#img_bubblemeta_on").css("border-color", "#404040");
			$("#img_bubblemeta_off").css("border-color", "white");
		} else {
			$("#meta").prop("checked", false);
			$("#img_bubblemeta_on").css("border-color", "white");
			$("#img_bubblemeta_off").css("border-color", "#404040");
		}

		if(crOp === true) {
			$("#customResolver").prop("checked", true);
			$(".cr_dependent").removeClass( 'cr_dependent_hidden' );	
			setCrPreviews(); // Depends on text fields being filled already
		} else {
			$("#customResolver").prop("checked", false);
			$(".cr_dependent").addClass( 'cr_dependent_hidden' );		
		}

		if(sdOp === true) {
			$("#syncData").prop("checked", true);
			$("#syncDataWipe").css("display", "block");
		} else {
			$("#syncData").prop("checked", false);
			$("#syncDataWipe").css("display", "none");
		}

		$("#crAutolink").val(craOp);
		$("#crBubble").val(crbOp);
		$("#crContext").val(crcOp);
		$("#crOmnibox").val(croOp);
		$("#omniboxOpento").val(otOp);
		$("#autolinkApplyto").val(alpOp);
		$("#autoLinkRewrite").prop("checked", alrOp);

		verifyAutolinkPermission(startChangeListeners);
	});
	});
}

// Only refresh fields that need updating after save
function minimalOptionsRefresh() {
	var cm = $("#context").prop('checked');
	var meta = $("#meta").prop('checked');
	var cr = $("#customResolver").prop('checked');

	if(cm) {
		$("#img_context_on").css("border-color", "#404040");
		$("#img_context_off").css("border-color", "white");
	} else {
		$("#img_context_on").css("border-color", "white");
		$("#img_context_off").css("border-color", "#404040");
	}

	if(meta) {
		$("#img_bubblemeta_on").css("border-color", "#404040");
		$("#img_bubblemeta_off").css("border-color", "white");
	} else {
		$("#img_bubblemeta_on").css("border-color", "white");
		$("#img_bubblemeta_off").css("border-color", "#404040");
	}

	if(cr) {
		$(".cr_dependent").removeClass("cr_dependent_hidden");	
		setCrPreviews();
	} else {
		$(".cr_dependent").addClass( 'cr_dependent_hidden' );	
	}
}

function storageListener(enable) {
	if(typeof storageListener.status === 'undefined')
		storageListener.status = true;

	if(enable) {
		storageListener.status = true;
	} else {
		storageListener.status = false;
	}
}

function storageChangeHandler(changes, namespace) {
	if(storageListener.status !== true) {
		return;
	}

	/* sync_reset is handled in the background page */
	if(namespace === "sync" && typeof changes["sync_reset"] === 'undefined') {
		var options = [
			"auto_link_rewrite",
			"context_menu",
			"meta_buttons",
			"custom_resolver",
			"cr_autolink",
			"cr_bubble",
			"cr_context",
			"cr_omnibox",
			"doi_resolver",
			"shortdoi_resolver",
			"omnibox_tab"
		];
		for(var key in changes) {
			if(options.indexOf(key) >= 0) {
				restoreOptions();
				break;
			}
		}
	}
}

function setCrPreviews() {
	var drInput = $("#doiResolverInput").val();
	var srInput = $("#shortDoiResolverInput").val();
	var drPreview = "";
	var srPreview = "";

	if(drInput.length <= 10) {
		drPreview = drInput + "10.1000/182";
	} else {
		drPreview = "&hellip;" + drInput.slice(-10, drInput.length) + "10.1000/182";
	}
	if(srInput.length <= 10) {
		srPreview = srInput + "dws9sz";
	} else {
		srPreview = "&hellip;" + srInput.slice(-10, srInput.length) + "dws9sz";
	}

	$("#doiResolverOutput").html(drPreview);
	$("#shortDoiResolverOutput").html(srPreview);
}

function setAutolinkPermission() {
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
	var al = $("#autoLink").prop('checked');

	if(al) {
		chrome.permissions.request({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*', 'https://*/*' ]
		}, function(granted) {
			if(granted) {
				autolinkShufflePerms();
			} else {
				$("#autolinkApplyto").val("http");
				$("#autoLink").prop("checked", false);
				$(".al_dependent").addClass("al_dependent_hidden");	
				startChangeListeners();
			}
		});
	} else {
		chrome.permissions.remove({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*', 'https://*/*' ]
		}, function(removed) {
			if(removed) {
				$("#autoLink").prop("checked", false);
				$(".al_dependent").addClass("al_dependent_hidden");
				chrome.runtime.sendMessage({cmd: "auto_link"});
				startChangeListeners();
				console.log("Autolink permissions removed");
			} else {
				$("#autoLink").prop("checked", true);
				$(".al_dependent").removeClass("al_dependent_hidden");
				chrome.runtime.sendMessage({cmd: "auto_link"});
				startChangeListeners();
				console.log("Could not remove autolink permissions");
			}
		});
	}
}

function autolinkShufflePerms() {
	// Only called if permissions have been granted by user
	var alp = $("#autolinkApplyto option:selected").val();

	if(alp === "http") {
		chrome.permissions.remove({
			origins: [ 'https://*/*' ]
		}, function(removed) {
			chrome.runtime.sendMessage({cmd: "auto_link"});
			verifyAutolinkPermission(startChangeListeners);
		});
	} else if(alp === "https") {
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

function verifyAutolinkPermission(callback) {
	chrome.permissions.contains({
		permissions: [ 'tabs' ],
		origins: [ 'http://*/*', 'https://*/*' ]
	}, function(result) {
		if(result) {
			$("#autolinkApplyto").val("httphttps");
			$("#autoLink").prop("checked", true);
			$(".al_dependent").removeClass("al_dependent_hidden");
			callback();
		} else {
			chrome.permissions.contains({
				permissions: [ 'tabs' ],
				origins: [ 'http://*/*' ]
			}, function(result) {
				if(result) {
					$("#autolinkApplyto").val("http");
					$("#autoLink").prop("checked", true);
					$(".al_dependent").removeClass("al_dependent_hidden");
					callback();
				} else {
					chrome.permissions.contains({
						permissions: [ 'tabs' ],
						origins: [ 'https://*/*' ]
					}, function(result) {
						if(result) {
							$("#autolinkApplyto").val("https");
							$("#autoLink").prop("checked", true);
							$(".al_dependent").removeClass("al_dependent_hidden");
							callback();
						} else {
							$("#autoLink").prop("checked", false);
							$(".al_dependent").addClass("al_dependent_hidden");
							callback();
						}
					});
				}
			});
		}
	});
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("optionsTitle");
	document.title = message;
	message = chrome.i18n.getMessage("optionsTitle");
	$("#optionsTitle").html(message);
	message = chrome.i18n.getMessage("optionContextMenu");
	$("#optionContextMenu").html(message);
	message = chrome.i18n.getMessage("optionMetaButtons");
	$("#optionMetaButtons").html(message);
	message = chrome.i18n.getMessage("optionCustomResolver");
	$("#optionCustomResolver").html(message);
	message = chrome.i18n.getMessage("optionCustomResolverSelection");
	$("#optionCustomResolverSelection").html(message);
	message = chrome.i18n.getMessage("optionCrAutolink");
	$("#optionCrAutolink").html(message);
	message = chrome.i18n.getMessage("optionCrBubble");
	$("#optionCrBubble").html(message);
	message = chrome.i18n.getMessage("optionCrContext");
	$("#optionCrContext").html(message);
	message = chrome.i18n.getMessage("optionCrOmnibox");
	$("#optionCrOmnibox").html(message);
	message = chrome.i18n.getMessage("optionCrCustom");
	$(".optionCrCustom").html(message);
	message = chrome.i18n.getMessage("optionCrDefault");
	$(".optionCrDefault").html(message);
	message = chrome.i18n.getMessage("optionCrSelectable");
	$(".optionCrSelectable").html(message);
	message = chrome.i18n.getMessage("textDoiResolverInput");
	$("#textDoiResolverInput").html(message);
	message = chrome.i18n.getMessage("textShortDoiResolverInput");
	$("#textShortDoiResolverInput").html(message);
	message = chrome.i18n.getMessage("doiOutputUrlExample");
	$("#doiOutputUrlExample").html(message);
	message = chrome.i18n.getMessage("doiOutputUrlExample");
	$("#shortDoiOutputUrlExample").html(message);
	message = chrome.i18n.getMessage("optionAutoLink");
	$("#optionAutoLink").html(message);
	message = chrome.i18n.getMessage("optionAutoLinkRewrite");
	$("#optionAutoLinkRewrite").html(message);
	message = chrome.i18n.getMessage("optionOmniboxOpento");
	$("#optionOmniboxOpento").html(message);
	message = chrome.i18n.getMessage("optionOmniboxOpentoCurtab");
	$("#optionOmniboxOpentoCurtab").html(message);
	message = chrome.i18n.getMessage("optionOmniboxOpentoNewForetab");
	$("#optionOmniboxOpentoNewForetab").html(message);
	message = chrome.i18n.getMessage("optionOmniboxOpentoNewBacktab");
	$("#optionOmniboxOpentoNewBacktab").html(message);
	message = chrome.i18n.getMessage("autoLinkInfo");
	$("#autoLinkInfo").html(message);
	message = chrome.i18n.getMessage("optionAutolinkApplyto");
	$("#optionAutolinkApplyto").html(message);
	message = chrome.i18n.getMessage("syncDataInfo");
	$("#syncDataInfo").html(message);
	message = chrome.i18n.getMessage("optionSyncData");
	$("#optionSyncData").html(message);
	message = chrome.i18n.getMessage("syncDataWipeDescription");
	$("#syncDataWipeDescription").html(message);

	$("#extensionVersion").html(chrome.app.getDetails().version);
}

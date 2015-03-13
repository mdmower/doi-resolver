/*!
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
	getLocalMessages();
	fetchOptions({cl: false, csr: false});
	startClickListeners();
}, false);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch(request.cmd) {
		case "fetch_complete":
			var cycleListeners = request.cl;
			if(cycleListeners) {
				haltChangeListeners();
			}
			restoreOptions();
			startChangeListeners();
			break;
		default:
			break;
	}
});

function startClickListeners() {
	$("#context").on("click", saveOptions);
	$("#meta").on("click", saveOptions);
	$("#autoLink").on("click", saveOptions);
	$("#customResolver").on("click", saveOptions);
	$("#syncData").on("click", syncHandler);

	$("#options_tab").on("click", function() {
		$("#content_options").css("display", "block");
		$("#content_about").css("display", "none");
	});
	$("#about_tab").on("click", function() {
		$("#content_options").css("display", "none");
		$("#content_about").css("display", "block");
	});

	$("#doiResolverInputReset").on("click", function() {
		$("#doiResolverInput").val("http://dx.doi.org/");
		saveOptions();
	});
	$("#shortDoiResolverInputReset").on("click", function() {
		$("#shortDoiResolverInput").val("http://doi.org/");
		saveOptions();
	});

	$("#img_context_off").on("click", function() {
		$("#context").prop("checked", false);
		saveOptions();
	});
	$("#img_context_on").on("click", function() {
		$("#context").prop("checked", true);
		saveOptions();
	});
	$("#img_bubblemeta_off").on("click", function() {
		$("#meta").prop("checked", false);
		saveOptions();
	});
	$("#img_bubblemeta_on").on("click", function() {
		$("#meta").prop("checked", true);
		saveOptions();
	});
	$("#syncDataWipeButton").on("click", function() {
		$("#syncData").prop("checked", false);
		$("#syncDataWipe").css("display", "none");
		localStorage["sync_reset"] = true;
		chrome.runtime.sendMessage({cmd: "sync_listener", enable: false},
			function(response) {
				syncOptions();
			}
		);
	});
}

function startChangeListeners() {
	/*
	 * doiResolverInput and shortDoiResolverInput can fire onChange events
	 * frequently. debounce them to only run once per 750ms so Chrome Sync
	 * doesn't get too many sync requests.
	 */
	var dbSaveOptions = _.debounce(saveOptions, 750);

	$(".crSelections").on("change", saveOptions);
	$("#doiResolverInput").on("change input", dbSaveOptions);
	$("#shortDoiResolverInput").on("change input", dbSaveOptions);
	$("#omniboxOpento").on("change", saveOptions);
	$("#autolinkApplyto").on("change", saveOptions);
}

function haltChangeListeners() {
	var dbSaveOptions = _.debounce(saveOptions, 750);

	$(".crSelections").off("change", saveOptions);
	$("#doiResolverInput").off("change input", dbSaveOptions);
	$("#shortDoiResolverInput").off("change input", dbSaveOptions);
	$("#omniboxOpento").off("change", saveOptions);
	$("#autolinkApplyto").off("change", saveOptions);
}

function syncOptions() {
	chrome.runtime.sendMessage({cmd: "sync_opts"});
}

function fetchOptions(params) {
	chrome.runtime.sendMessage({cmd: "fetch_opts", cl: params.cl, csr: params.csr});
}

function syncHandler() {
	/*
	 * If sync has just been switched to enabled, make an attempt to populate
	 * local storage with synced settings and then refresh page.
	 */
	var sd = $("#syncData").is(":checked");
	localStorage["sync_data"] = sd;
	if(sd) {
		$("#syncDataWipe").css("display", "block");
		fetchOptions({cl: true, csr: true});
	} else {
		$("#syncDataWipe").css("display", "none");
		chrome.runtime.sendMessage({cmd: "sync_listener", enable: false});
	}
}

function saveOptions() {
	localStorage["context_menu"] = $("#context").is(":checked");
	localStorage["meta_buttons"] = $("#meta").is(":checked");
	localStorage["custom_resolver"] = $("#customResolver").is(":checked");
	localStorage["cr_autolink"] = $("#crAutolink option:selected").val();
	localStorage["cr_bubble"] = $("#crBubble option:selected").val();
	localStorage["cr_context"] = $("#crContext option:selected").val();
	localStorage["cr_omnibox"] = $("#crOmnibox option:selected").val();
	localStorage["doi_resolver"] = $("#doiResolverInput").val();
	localStorage["shortdoi_resolver"] = $("#shortDoiResolverInput").val();
	localStorage["omnibox_tab"] = $("#omniboxOpento option:selected").val();

	/*
	 * These options require permissions setting/checking. Only call them
	 * if the current setting differs from stored setting
	 */
	var alCur = $("#autoLink").is(":checked");
	var alpCur = $("#autolinkApplyto option:selected").val();
	var alBool = (localStorage["auto_link"] == "true");
	var alpStr = localStorage["al_protocol"];
	var callAL = (alCur != alBool || alpCur != alpStr);
	if(callAL) {
		setAutolinkPermission();
	}

	// Background function autoLinkDOIs() handles sync
	if(!callAL) {
		syncOptions();
	}

	minimalOptionsRefresh();
}

function restoreOptions() {
	var cmOp = localStorage["context_menu"];
	var metaOp = localStorage["meta_buttons"];
	var crOp = localStorage["custom_resolver"];
	var craOp = localStorage["cr_autolink"];
	var crbOp = localStorage["cr_bubble"];
	var crcOp = localStorage["cr_context"];
	var croOp = localStorage["cr_omnibox"];
	var drOp = localStorage["doi_resolver"];
	var srOp = localStorage["shortdoi_resolver"];
	var otOp = localStorage["omnibox_tab"];
	var alpOp = localStorage["al_protocol"];
	var sdOp = localStorage["sync_data"];

	$("#doiResolverInput").val(drOp);
	$("#shortDoiResolverInput").val(srOp);

	if(cmOp == "true") {
		$("#context").prop("checked", true);
		$("#img_context_on").css("border-color", "#404040");
		$("#img_context_off").css("border-color", "white");
		chrome.runtime.sendMessage({
			cmd: "context_menu",
			setting: "enable"
		});
	} else {
		$("#context").prop("checked", false);
		$("#img_context_on").css("border-color", "white");
		$("#img_context_off").css("border-color", "#404040");
		chrome.runtime.sendMessage({
			cmd: "context_menu",
			setting: "disable"
		});
	}

	if(metaOp == "true") {
		$("#meta").prop("checked", true);
		$("#img_bubblemeta_on").css("border-color", "#404040");
		$("#img_bubblemeta_off").css("border-color", "white");
	} else {
		$("#meta").prop("checked", false);
		$("#img_bubblemeta_on").css("border-color", "white");
		$("#img_bubblemeta_off").css("border-color", "#404040");
	}

	if(crOp == "true") {
		$("#customResolver").prop("checked", true);
		$("#customResolverLeft").css("display", "inline-block");
		$("#customResolverRight").css("display", "inline-block");
		setCrPreviews();
	} else {
		$("#customResolver").prop("checked", false);
		$("#customResolverLeft").css("display", "none");
		$("#customResolverRight").css("display", "none");
	}

	if(sdOp == "true") {
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

	verifyAutolinkPermission();
}

// Only refresh fields that need updating after save
function minimalOptionsRefresh() {
	var cm = $("#context").is(":checked");
	var meta = $("#meta").is(":checked");
	var cr = $("#customResolver").is(":checked");

	if(cm) {
		$("#img_context_on").css("border-color", "#404040");
		$("#img_context_off").css("border-color", "white");
		chrome.runtime.sendMessage({
			cmd: "context_menu",
			setting: "enable"
		});
	} else {
		$("#img_context_on").css("border-color", "white");
		$("#img_context_off").css("border-color", "#404040");
		chrome.runtime.sendMessage({
			cmd: "context_menu",
			setting: "disable"
		});
	}

	if(meta) {
		$("#img_bubblemeta_on").css("border-color", "#404040");
		$("#img_bubblemeta_off").css("border-color", "white");
	} else {
		$("#img_bubblemeta_on").css("border-color", "white");
		$("#img_bubblemeta_off").css("border-color", "#404040");
	}

	if(cr) {
		$("#customResolverLeft").css("display", "inline-block");
		$("#customResolverRight").css("display", "inline-block");
		setCrPreviews();
	} else {
		$("#customResolverLeft").css("display", "none");
		$("#customResolverRight").css("display", "none");
	}
}

function setCrPreviews() {
	var drOp = localStorage["doi_resolver"];
	var srOp = localStorage["shortdoi_resolver"];
	var drPreview = "";
	var srPreview = "";

	if(drOp.length <= 10) {
		drPreview = drOp + "10.1000/182";
	} else {
		drPreview = "&hellip;" + drOp.slice(-10, drOp.length) + "10.1000/182";
	}
	if(srOp.length <= 10) {
		srPreview = srOp + "dws9sz";
	} else {
		srPreview = "&hellip;" + srOp.slice(-10, srOp.length) + "dws9sz";
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

	var al = $("#autoLink").is(":checked");

	if(al) {
		chrome.permissions.request({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*', 'https://*/*' ]
		}, function(granted) {
			if(granted) {
				autolinkShufflePerms();
				$("#autoLink").prop("checked", true);
				$("#alProtocol").css("display", "block");
				syncOptions();
			} else {
				$("#autolinkApplyto").val("http");
				$("#autoLink").prop("checked", false);
				$("#alProtocol").css("display", "none");
				syncOptions();
			}
		});
	} else {
		chrome.permissions.remove({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*', 'https://*/*' ]
		}, function(removed) {
			if(removed) {
				$("#autoLink").prop("checked", false);
				$("#alProtocol").css("display", "none");
				chrome.runtime.sendMessage({cmd: "auto_link"});
				syncOptions();
				console.log("Autolink permissions removed");
			} else {
				$("#autoLink").prop("checked", true);
				$("#alProtocol").css("display", "block");
				chrome.runtime.sendMessage({cmd: "auto_link"});
				syncOptions();
				console.log("Could not remove autolink permissions");
			}
		});
	}
}

function autolinkShufflePerms() {
	// Only called if permissions have been granted by user
	var alp = $("#autolinkApplyto option:selected").val();

	if(alp == "http") {
		chrome.permissions.remove({
			origins: [ 'https://*/*' ]
		}, function(removed) {
			chrome.runtime.sendMessage({cmd: "auto_link"});
			verifyAutolinkPermission();
		});
	} else if(alp == "https") {
		chrome.permissions.remove({
			origins: [ 'http://*/*' ]
		}, function(removed) {
			chrome.runtime.sendMessage({cmd: "auto_link"});
			verifyAutolinkPermission();
		});
	} else {
		chrome.runtime.sendMessage({cmd: "auto_link"});
		verifyAutolinkPermission();
	}
}

function verifyAutolinkPermission() {
	chrome.permissions.contains({
		permissions: [ 'tabs' ],
		origins: [ 'http://*/*', 'https://*/*' ]
	}, function(result) {
		if(result) {
			$("#autolinkApplyto").val("httphttps");
			$("#autoLink").prop("checked", true);
			$("#alProtocol").css("display", "block");
		} else {
			chrome.permissions.contains({
				permissions: [ 'tabs' ],
				origins: [ 'http://*/*' ]
			}, function(result) {
				if(result) {
					$("#autolinkApplyto").val("http");
					$("#autoLink").prop("checked", true);
					$("#alProtocol").css("display", "block");
				} else {
					chrome.permissions.contains({
						permissions: [ 'tabs' ],
						origins: [ 'https://*/*' ]
					}, function(result) {
						if(result) {
							$("#autolinkApplyto").val("https");
							$("#autoLink").prop("checked", true);
							$("#alProtocol").css("display", "block");
						} else {
							$("#autoLink").prop("checked", false);
							$("#alProtocol").css("display", "none");
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

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
	restoreOptions(true);
	getLocalMessages();
	startListeners();
}, false);

function startListeners() {
	$("#context").on("click", saveOptions);
	$("#meta").on("click", saveOptions);
	$("#autoLink").on("click", saveOptions);
	$("#customResolver").on("click", saveOptions);
	$(".crSelections").on("change", saveOptions);
	$("#doiResolverInput").on("change input", saveOptions);
	$("#shortDoiResolverInput").on("change input", saveOptions);

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

	$("#optionAutoLink").hover(function() {
		$("#autoLinkInfo").css("color","#500000");
		}, function() {
		$("#autoLinkInfo").css("color","white");
	});
	$("#autoLink").hover(function() {
		$("#autoLinkInfo").css("color","#500000");
		}, function() {
		$("#autoLinkInfo").css("color","white");
	});
}

// Saves options to localStorage
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
	localStorage["auto_link"] = $("#autoLink").is(":checked");

	minimalOptionsRefresh(false);
}

// Restores options from localStorage
function restoreOptions(pageOpen) {
	var cmOp = localStorage["context_menu"];
	var metaOp = localStorage["meta_buttons"];
	var crOp = localStorage["custom_resolver"];
	var craOp = localStorage["cr_autolink"];
	var crbOp = localStorage["cr_bubble"];
	var crcOp = localStorage["cr_context"];
	var croOp = localStorage["cr_omnibox"];
	var drOp = localStorage["doi_resolver"];
	var srOp = localStorage["shortdoi_resolver"];
	var alOp = localStorage["auto_link"];

	$("#doiResolverInput").val(drOp);
	$("#shortDoiResolverInput").val(srOp);

	if(cmOp == "true") {
		$("#context").prop("checked", true);
		$("#img_context_on").css("border-color", "#404040");
		$("#img_context_off").css("border-color", "white");
		chrome.extension.sendRequest({cmd: "enable_context"});
	} else {
		$("#context").prop("checked", false);
		$("#img_context_on").css("border-color", "white");
		$("#img_context_off").css("border-color", "#404040");
		chrome.extension.sendRequest({cmd: "disable_context"});
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
		$("#doiResolverOutput").html(drOp + "10.1000/182");
		$("#shortDoiResolverOutput").html(srOp + "dws9sz");
	} else {
		$("#customResolver").prop("checked", false);
		$("#customResolverLeft").css("display", "none");
		$("#customResolverRight").css("display", "none");
	}

	$("#crAutolink").val(craOp);
	$("#crBubble").val(crbOp);
	$("#crContext").val(crcOp);
	$("#crOmnibox").val(croOp);

	if(pageOpen == true) { // To do: change to CHECK permission instead of assuming ok
		if(alOp == "true") {
			$("#autoLink").prop("checked", true);
		} else {
			$("#autoLink").prop("checked", false);
		}
	} else {
		setAutoLinkPermission();
		addRemoveAutoLinkListener();
	}
}

// Only refresh fields that need updating after save
function minimalOptionsRefresh(pageOpen) {
	var cmOp = localStorage["context_menu"];
	var metaOp = localStorage["meta_buttons"];
	var crOp = localStorage["custom_resolver"];
	var drOp = localStorage["doi_resolver"];
	var srOp = localStorage["shortdoi_resolver"];
	var alOp = localStorage["auto_link"];

	if(cmOp == "true") {
		$("#img_context_on").css("border-color", "#404040");
		$("#img_context_off").css("border-color", "white");
		chrome.extension.sendRequest({cmd: "enable_context"});
	} else {
		$("#img_context_on").css("border-color", "white");
		$("#img_context_off").css("border-color", "#404040");
		chrome.extension.sendRequest({cmd: "disable_context"});
	}

	if(metaOp == "true") {
		$("#img_bubblemeta_on").css("border-color", "#404040");
		$("#img_bubblemeta_off").css("border-color", "white");
	} else {
		$("#img_bubblemeta_on").css("border-color", "white");
		$("#img_bubblemeta_off").css("border-color", "#404040");
	}

	if(crOp == "true") {
		$("#customResolverLeft").css("display", "inline-block");
		$("#customResolverRight").css("display", "inline-block");
		$("#doiResolverOutput").html(drOp + "10.1000/182");
		$("#shortDoiResolverOutput").html(srOp + "dws9sz");
	} else {
		$("#customResolverLeft").css("display", "none");
		$("#customResolverRight").css("display", "none");
	}

	if(pageOpen == true) { // To do: change to CHECK permission instead of assuming ok
		if(alOp == "true") {
			$("#autoLink").prop("checked", true);
		} else {
			$("#autoLink").prop("checked", false);
		}
	} else {
		setAutoLinkPermission();
		addRemoveAutoLinkListener();
	}
}

function setAutoLinkPermission() {
	var alOp = localStorage["auto_link"];

	if(alOp == "true") {
		chrome.permissions.request({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*' ]
		}, function(granted) {
			if(granted) {
				localStorage["auto_link"] = true;
				$("#autoLink").prop("checked", true);
			} else {
				localStorage["auto_link"] = false;
				$("#autoLink").prop("checked", false);
			}
		});
	} else {
		chrome.permissions.remove({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*' ]
		}, function(removed) {
			if(removed) {
				localStorage["auto_link"] = false;
				$("#autoLink").prop("checked", false);
			} else {
				localStorage["auto_link"] = true;
				$("#autoLink").prop("checked", true);
			}
		});
	}
}

function addRemoveAutoLinkListener() {
	chrome.permissions.contains({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*' ]
	}, function(result) {
	if(result) {
		chrome.tabs.onUpdated.addListener(function(tab) {
			chrome.tabs.executeScript(tab.id, {file: "autolink.js"});
		});
		chrome.tabs.onCreated.addListener(function(tab) {
			chrome.tabs.executeScript(tab.id, {file: "autolink.js"});
	});
	} else {
		chrome.tabs.onUpdated.removeListener();
		chrome.tabs.onCreated.removeListener();
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
	message = chrome.i18n.getMessage("autoLinkInfo");
	$("#autoLinkInfo").html(message);
	message = chrome.i18n.getMessage("optionsDescription");
	$("#optionsDescription").html(message);
}

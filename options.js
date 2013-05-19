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
	document.getElementById("context").addEventListener("click", saveOptions, false);
	document.getElementById("meta").addEventListener("click", saveOptions, false);
	document.getElementById("autoLink").addEventListener("click", saveOptions, false);
	document.getElementById("customResolver").addEventListener("click", saveOptions, false);

	document.getElementById("doiResolverInputSave").addEventListener("click", saveOptions, false);
	document.getElementById("shortDoiResolverInputSave").addEventListener("click", saveOptions, false);
	document.getElementById("doiResolverInputReset").addEventListener("click", function() {
		document.getElementById("doiResolverInput").value = "http://dx.doi.org/";
		saveOptions();
	}, false);
	document.getElementById("shortDoiResolverInputReset").addEventListener("click", function() {
		document.getElementById("shortDoiResolverInput").value = "http://doi.org/";
		saveOptions();
	}, false);

	document.getElementById("img_context_off").addEventListener("click", function() {
		document.getElementById("context").checked = false;
		saveOptions();
	}, false);
	document.getElementById("img_context_on").addEventListener("click", function() {
		document.getElementById("context").checked = true;
		saveOptions();
	}, false);
	document.getElementById("img_bubblemeta_off").addEventListener("click", function() {
		document.getElementById("meta").checked = false;
		saveOptions();
	}, false);
	document.getElementById("img_bubblemeta_on").addEventListener("click", function() {
		document.getElementById("meta").checked = true;
		saveOptions();
	}, false);

	jQuery("#optionAutoLink").hover(function(){
		$("#autoLinkInfo").css("color","#500000");
		},function(){
		$("#autoLinkInfo").css("color","white");
	});
	jQuery("#autoLink").hover(function(){
		$("#autoLinkInfo").css("color","#500000");
		},function(){
		$("#autoLinkInfo").css("color","white");
	});
}

// Saves options to localStorage
function saveOptions() {
	localStorage["context_menu"] = document.getElementById("context").checked;
	localStorage["meta_buttons"] = document.getElementById("meta").checked;
	localStorage["custom_resolver"] = document.getElementById("customResolver").checked;
	localStorage["doi_resolver"] = document.getElementById("doiResolverInput").value;
	localStorage["shortdoi_resolver"] = document.getElementById("shortDoiResolverInput").value;
	localStorage["auto_link"] = document.getElementById("autoLink").checked;

	restoreOptions(false);
}

// Restores options from localStorage
function restoreOptions(pageOpen) {
	var cmOp = localStorage["context_menu"];
	var metaOp = localStorage["meta_buttons"];
	var crOp = localStorage["custom_resolver"];
	var drOp = localStorage["doi_resolver"];
	var srOp = localStorage["shortdoi_resolver"];
	var alOp = localStorage["auto_link"];

	document.getElementById("doiResolverInput").value = drOp;
	document.getElementById("shortDoiResolverInput").value = srOp;

	var cmBox = document.getElementById("context");
	var metaBox = document.getElementById("meta");
	var crBox = document.getElementById("customResolver");
	var alBox = document.getElementById("autoLink");

	if(cmOp == "true") {
		cmBox.checked = true;
		document.getElementById("img_context_on").style.borderColor="#404040";
		document.getElementById("img_context_off").style.borderColor="white";
		chrome.extension.sendRequest({cmd: "enable_context"});
	} else {
		cmBox.checked = false;
		document.getElementById("img_context_on").style.borderColor="white";
		document.getElementById("img_context_off").style.borderColor="#404040";
		chrome.extension.sendRequest({cmd: "disable_context"});
	}

	if(metaOp == "true") {
		metaBox.checked = true;
		document.getElementById("img_bubblemeta_on").style.borderColor="#404040";
		document.getElementById("img_bubblemeta_off").style.borderColor="white";
	} else {
		metaBox.checked = false;
		document.getElementById("img_bubblemeta_on").style.borderColor="white";
		document.getElementById("img_bubblemeta_off").style.borderColor="#404040";
	}

	if(crOp == "true") {
		crBox.checked = true;
		document.getElementById("customResolverFields").style.display = "block";
		document.getElementById("doiResolverOutput").innerHTML = drOp + "10.1000/182";
		document.getElementById("shortDoiResolverOutput").innerHTML = srOp + "dws9sz";
	} else {
		crBox.checked = false;
		document.getElementById("customResolverFields").style.display = "none";
	}

	if(pageOpen == true) { //change to CHECK permission instead of assuming ok
		if(alOp == "true") alBox.checked = true;
		else alBox.checked = false;
	} else {
		setAutoLinkPermission();
		addRemoveAutoLinkListener();
	}
}

function setAutoLinkPermission() {
	var alOp = localStorage["auto_link"];
	var alBox = document.getElementById("autoLink");

	if(alOp == "true") {
		chrome.permissions.request({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*' ]
		}, function(granted) {
			if(granted) {
				localStorage["auto_link"] = true;
				alBox.checked = true;
			} else {
				localStorage["auto_link"] = false;
				alBox.checked = false;
			}
		});
	} else {
		chrome.permissions.remove({
			permissions: [ 'tabs' ],
			origins: [ 'http://*/*' ]
		}, function(removed) {
			if(removed) {
				localStorage["auto_link"] = false;
				alBox.checked = false;
			} else {
				localStorage["auto_link"] = true;
				alBox.checked = true;
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
	document.getElementById("optionsTitle").innerHTML = message;
	message = chrome.i18n.getMessage("optionContextMenu");
	document.getElementById("optionContextMenu").innerHTML = message;
	message = chrome.i18n.getMessage("optionMetaButtons");
	document.getElementById("optionMetaButtons").innerHTML = message;
	message = chrome.i18n.getMessage("optionCustomResolver");
	document.getElementById("optionCustomResolver").innerHTML = message;
	message = chrome.i18n.getMessage("textDoiResolverInput");
	document.getElementById("textDoiResolverInput").innerHTML = message;
	message = chrome.i18n.getMessage("textShortDoiResolverInput");
	document.getElementById("textShortDoiResolverInput").innerHTML = message;
	message = chrome.i18n.getMessage("doiOutputUrlExample");
	document.getElementById("doiOutputUrlExample").innerHTML = message;
	message = chrome.i18n.getMessage("doiOutputUrlExample");
	document.getElementById("shortDoiOutputUrlExample").innerHTML = message;
	message = chrome.i18n.getMessage("optionAutoLink");
	document.getElementById("optionAutoLink").innerHTML = message;
	message = chrome.i18n.getMessage("autoLinkInfo");
	document.getElementById("autoLinkInfo").innerHTML = message;
	message = chrome.i18n.getMessage("optionsDescription");
	document.getElementById("optionsDescription").innerHTML = message;
	message = "";
}

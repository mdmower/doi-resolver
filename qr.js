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
	storage(true);
}, false);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.cmd) {
	case "sync_toggle_complete":
		storage(false);
		break;
	default:
		break;
	}
});

function storage(firstRun) {
	if (typeof storage.area === 'undefined') {
		storage.area = chrome.storage.local;
	}

	chrome.storage.local.get(["sync_data"], function(stg) {
		if (stg.sync_data === true) {
			storage.area = chrome.storage.sync;
		} else {
			storage.area = chrome.storage.local;
		}

		if (firstRun === true) {
			continueOnLoad();
		}
	});
}

function continueOnLoad() {
	getLocalMessages();
	getUrlVariables();
	restoreOptions();
	prepareColorPickers();
	populateHistory();
	startListeners();
}

function startListeners() {
	/*
	 * qrSizeInput can fire onChange events frequently. debounce it to only run
	 * once per 750ms so Chrome Sync doesn't get too many sync requests.
	 */
	var dbQrSizeSave = _.debounce(qrSizeSave, 750);

	document.getElementById("doiForm").addEventListener("submit", function (event) {
		formSubmitHandler();
		event.preventDefault();
	});
	document.getElementById("qrBgTrans").addEventListener("change", function () {
		toggleBgColor();
		saveOptions();
	});
	document.getElementById("qrFetchTitle").addEventListener("change", setDoiMetaPermissions);
	document.getElementById("qrSizeInput").addEventListener("input", dbQrSizeSave);
	document.getElementById("qrManualTitle").addEventListener("change", toggleTitleFetch);

	chrome.tabs.getCurrent(function(tab) {
		var tabRecord = chrome.extension.getBackgroundPage().tabRecord;
		tabRecord(tab.id, true);
	});
}

function toggleBgColor() {
	var qrBgTrans = document.getElementById("qrBgTrans").checked;
	document.getElementById("bgColorDiv").style.display = qrBgTrans ? "none" : "block";
}

function qrSizeSave() {
	var qrSize = Number(document.getElementById("qrSizeInput").value);
	if (isNaN(qrSize)) {
		document.getElementById("qrSizeInput").value = 300;
		qrSize = 300;
	} else if (qrSize < 80) {
		document.getElementById("qrSizeInput").value = 80;
		qrSize = 80;
	}

	storage.area.get(["qr_size"], function(stg) {
		if (parseInt(stg.qr_size) !== qrSize) {
			saveOptions();
		}
	});
}

// Read a page's GET URL variables and return them as an associative array.
// https://jquery-howto.blogspot.com/2009/09/get-url-parameters-values-with-jquery.html
function getUrlVariables() {
	var vars = [], hash;
	var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
	for (var i = 0; i < hashes.length; i++) {
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	}

	var initDOI = vars.doi;
	if (initDOI) {
		document.getElementById("doiInput").value = initDOI;
	}
}

function restoreOptions() {
	var stgFetch = [
		"qr_size",
		"qr_bgtrans"
	];

	chrome.storage.local.get(["qr_title"], function(stgLocal) {
	storage.area.get(stgFetch, function(stg) {
		var qrSize = parseInt(stg.qr_size);
		if (isNaN(qrSize)) {
			document.getElementById("qrSizeInput").value = 300;
		} else if (qrSize < 80) {
			document.getElementById("qrSizeInput").value = 80;
		} else {
			document.getElementById("qrSizeInput").value = qrSize;
		}

		document.getElementById("qrFetchTitle").checked = Boolean(stgLocal.qr_title);
		document.getElementById("qrBgTrans").checked = Boolean(stg.qr_bgtrans);
		document.getElementById("bgColorDiv").style.display = stg.qr_bgtrans ? "none" : "block";
	});
	});
}

function populateHistory() {
	var stgFetch = [
		"recorded_dois",
		"history_showsave"
	];

	storage.area.get(stgFetch, function(stg) {
		if (!Array.isArray(stg.recorded_dois)) {
			return;
		}

		// Skip holes in the array (should not occur)
		stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
			// Use !=, not !==, so that null is caught as well
			return elm != undefined;
		});

		var optionHtml = "";
		var message = chrome.i18n.getMessage("historySavedEntryLabel");
		var i;
		for (i = 0; i < stg.recorded_dois.length; i++) {
			if (stg.recorded_dois[i].save) {
				optionHtml += '<option value="' + stg.recorded_dois[i].doi + '" label="' + message + '" />';
			}
		}
		if (stg.history_showsave !== true) {
			for (i = 0; i < stg.recorded_dois.length; i++) {
				if (!stg.recorded_dois[i].save) {
					optionHtml += '<option value="' + stg.recorded_dois[i].doi + '" />';
				}
			}
		}
		document.getElementById("doiHistory").innerHTML = optionHtml;
	});
}

function isHexColor(code) {
	return /^#[0-9A-F]{6}$/i.test(code);
}

function prepareColorPickers() {
	var stgFetch = [
		"qr_fgcolor",
		"qr_bgcolor"
	];

	storage.area.get(stgFetch, function(stg) {

		var qrFgColor = "#000000";
		var storedQrFgColor = stg.qr_fgcolor;
		if (isHexColor(storedQrFgColor)) {
			qrFgColor = storedQrFgColor;
		} else {
			chrome.storage.local.set({qr_fgcolor: qrFgColor}, function() {
				if (typeof chrome.runtime.lastError != 'undefined') {
					console.log(chrome.runtime.lastError);
				}
			});
		}
		document.getElementById("qrFgColorInput").value = qrFgColor;

		var qrBgColor = "#ffffff";
		var storedQrBgColor = stg.qr_bgcolor;
		if (isHexColor(storedQrBgColor)) {
			qrBgColor = storedQrBgColor;
		} else {
			chrome.storage.local.set({qr_bgcolor: qrBgColor}, function() {
				if (typeof chrome.runtime.lastError != 'undefined') {
					console.log(chrome.runtime.lastError);
				}
			});
		}
		document.getElementById("qrBgColorInput").value = qrBgColor;

		$("#qrFgColorInput").spectrum({
			color: qrFgColor,
			preferredFormat: "hex",
			showInput: true,
			clickoutFiresChange: true,
			replacerClassName: "qrColorReplacerClass",
			containerClassName: "qrColorContainerClass",
			change: function(color) {
				saveOptions();
			}
		});

		$("#qrBgColorInput").spectrum({
			color: qrBgColor,
			preferredFormat: "hex",
			showInput: true,
			clickoutFiresChange: true,
			replacerClassName: "qrColorReplacerClass",
			containerClassName: "qrColorContainerClass",
			change: function(color) {
				saveOptions();
			}
		});

	});
}

function saveOptions() {
	var options = {
		qr_bgtrans: document.getElementById("qrBgTrans").checked,
		qr_size: Number(document.getElementById("qrSizeInput").value),
		qr_fgcolor: document.getElementById("qrFgColorInput").value,
		qr_bgcolor: document.getElementById("qrBgColorInput").value,
		qr_title: document.getElementById("qrFetchTitle").checked
	};

	chrome.storage.local.set(options, null);
}

function toggleTitleFetch() {
	var qrFetchTitle = document.getElementById("qrFetchTitle");
	var qrManualTitleTextDiv = document.getElementById("qrManualTitleTextDiv");

	if (document.getElementById("qrManualTitle").checked) {
		qrFetchTitle.checked = false;
		qrFetchTitle.disabled = true;
		qrManualTitleTextDiv.style.display = "flex";
		saveOptions();
	} else {
		qrFetchTitle.disabled = false;
		qrManualTitleTextDiv.style.display = "none";
	}
}

function resetSpace() {
	var notifyDiv = document.getElementById("notifyDiv");
	var qrDiv = document.getElementById("qrDiv");
	notifyDiv.innerHTML = "";
	notifyDiv.style.display = "none";
	qrDiv.innerHTML = "";
	qrDiv.style.display = "none";
}

function simpleNotification(message) {
	resetSpace();
	document.getElementById("notifyDiv").innerHTML = message;
	document.getElementById("notifyDiv").style.display = "block";
}

function advancedNotification(elms) {
	resetSpace();
	var notifyDiv = document.getElementById("notifyDiv");
	for (var i = 0; i < elms.length; i++) {
		notifyDiv.appendChild(elms[i]);
	}
	notifyDiv.style.display = "block";
}

function setDoiMetaPermissions() {
	var qrFetchTitle = document.getElementById("qrFetchTitle");
	if (qrFetchTitle.checked) {
		chrome.permissions.request({
			origins: [
				'https://*.doi.org/',
				'https://*.crossref.org/',
				'https://*.datacite.org/'
			]
		}, function(granted) {
			qrFetchTitle.checked = granted;
			saveOptions();
		});
	} else {
		chrome.permissions.remove({
			origins: [
				'https://*.doi.org/',
				'https://*.crossref.org/',
				'https://*.datacite.org/'
			]
		}, function(removed) {
			qrFetchTitle.checked = !removed;
			saveOptions();
		});
	}
}

function formSubmitHandler() {
	var trim = chrome.extension.getBackgroundPage().trim;
	var doiInput = encodeURI(trim(document.getElementById("doiInput").value));
	var qrSize = Number(document.getElementById("qrSizeInput").value);
	var fgcolor = document.getElementById("qrFgColorInput").value;
	var bgcolor = document.getElementById("qrBgColorInput").value;

	if (document.getElementById("qrBgTrans").checked) {
		bgcolor = null;
	}

	if (isNaN(qrSize)) {
		document.getElementById("qrSizeInput").value = 300;
		qrSize = 300;
	} else if (qrSize < 80) {
		document.getElementById("qrSizeInput").value = 80;
		qrSize = 80;
	}

	var checkValidDoi = chrome.extension.getBackgroundPage().checkValidDoi;
	if (!checkValidDoi(doiInput)) {
		simpleNotification(chrome.i18n.getMessage("invalidDoiAlert"));
		return;
	}

	var recordDoi = chrome.extension.getBackgroundPage().recordDoi;
	recordDoi(doiInput)
	.catch((errMsg) => {
		console.log(errMsg);
	});

	insertQr(doiInput, qrSize, fgcolor, bgcolor);
}

function insertQr(doiInput, size, fgcolor, bgcolor) {
	resetSpace();

	var stringToEncode = "";
	var jsonUrl = "https://dx.doi.org/" + doiInput;

	if (/^10\./.test(doiInput)) {
		stringToEncode = "https://dx.doi.org/" + doiInput;
	} else if (/^10\//.test(doiInput)) {
		stringToEncode = "https://doi.org/" + doiInput.replace(/^10\//,"");
	}

	simpleNotification("Loading...");

	if (document.getElementById("qrFetchTitle").checked) {
		chrome.permissions.request({
			origins: [
				'https://*.doi.org/',
				'https://*.crossref.org/',
				'https://*.datacite.org/'
			]
		}, function(granted) {
			if (granted) {
				var fetchHeaders = new Headers();
				fetchHeaders.append("Accept", "application/citeproc+json");

				var fetchInit = {
					method: 'GET',
					headers: fetchHeaders,
					cache: false
				};

				var fetchRequest = new Request(jsonUrl, fetchInit);

				fetch(fetchRequest)
				.then(function(response) {
					return response.json();
				})
				.then(function(json) {
					try {
						var doiTitle = json.title;
						doiTitle = doiTitle.replace(/<subtitle>(.*)<\/subtitle>/, " - $1");
						doiTitle = doiTitle.replace(/<alt-title>(.*)<\/alt-title>/, "");
						doiTitle = doiTitle.replace(/<.*>(.*)<\/.*>/, "$1");
						stringToEncode = doiTitle + "\n" + stringToEncode;
						updateMessage(stringToEncode, "found");
						createQrImage(stringToEncode, size, fgcolor, bgcolor);
					} catch(ex) {
						updateMessage(stringToEncode, "missing");
						createQrImage(stringToEncode, size, fgcolor, bgcolor);
					}
				})
				.catch(function(error) {
					updateMessage(stringToEncode, "missing");
					createQrImage(stringToEncode, size, fgcolor, bgcolor);
				});
			} else {
				updateMessage(stringToEncode, "disabled");
				createQrImage(stringToEncode, size, fgcolor, bgcolor);
			}
		});
	} else {
		if (document.getElementById("qrManualTitle").checked) {
			var titleString = document.getElementById("qrManualTitleText").value;
			if (titleString !== "") {
				stringToEncode = titleString + "\n" + stringToEncode;
			}
		}
		updateMessage(stringToEncode, "disabled");
		createQrImage(stringToEncode, size, fgcolor, bgcolor);
	}
}

function createQrImage(text, size, fgcolor, bgcolor) {
	$("#qrDiv").qrcode({
		text: text,
		size: size,
		fill: fgcolor,
		background: bgcolor,
		render: 'image'
	});
	linkifyQrImage();
}

function updateMessage(stringToEncode, titleRetrieval) {
	var titleNotice = "";

	switch (titleRetrieval) {
	case "found":
		titleNotice = chrome.i18n.getMessage("qrTitleSuccess");
		break;
	case "missing":
		titleNotice = chrome.i18n.getMessage("qrTitleFailure");
		break;
	case "disabled":
		titleNotice = chrome.i18n.getMessage("qrDisabled");
		break;
	default:
		titleNotice = chrome.i18n.getMessage("qrDisabled");
		break;
	}

	var statusMessage = [];
	var tmp = document.createElement("span");
	tmp.setAttribute("class", "notifyHeading");
	tmp.innerHTML = chrome.i18n.getMessage("qrTitleStatus");
	statusMessage.push(tmp);
	tmp = document.createElement("span");
	tmp.setAttribute("class", "notifyContent");
	tmp.innerHTML = titleNotice;
	statusMessage.push(tmp);
	tmp = document.createElement("br");
	statusMessage.push(tmp);
	tmp = document.createElement("span");
	tmp.setAttribute("class", "notifyHeading");
	tmp.innerHTML = chrome.i18n.getMessage("qrMessageEncoded");
	statusMessage.push(tmp);
	tmp = document.createElement("span");
	tmp.setAttribute("class", "notifyContent");
	tmp.innerHTML = stringToEncode;
	statusMessage.push(tmp);

	advancedNotification(statusMessage);
}

function linkifyQrImage() {
	var qrImg = document.querySelector("#qrDiv img");
	if (qrImg === null) {
		return;
	}

	var saveLink = document.createElement("a");
	saveLink.setAttribute("id", "qrImageSaveLink");
	saveLink.setAttribute("href", qrImg.src);
	saveLink.setAttribute("download", "qrImage.png");

	var insertedLink = qrImg.parentNode.insertBefore(saveLink, qrImg);
	insertedLink.appendChild(qrImg);
	document.getElementById("qrDiv").style.display = "block";
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("qrHeading");
	document.title = message;

	var messageIds = [
		"doiInputLabel",
		"qrBgColorInputLabel",
		"qrBgTransLabel",
		"qrFetchTitleLabel",
		"qrFgColorInputLabel",
		"qrHeading",
		"qrManualTitleLabel",
		"qrManualTitleTextLabel",
		"qrSizeInputLabel",
		"qrSubHeading",
		"submitButton"
	];

	for (var i = 0; i < messageIds.length; i++) {
		message = chrome.i18n.getMessage(messageIds[i]);
		document.getElementById(messageIds[i]).innerHTML = message;
	}
}

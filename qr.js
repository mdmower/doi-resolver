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


	$("#doiForm").submit(function () {
		formSubmitHandler();
		return false;
	});
	$("#qrBgTrans").on("change", function() {
		toggleBgColor();
		saveOptions();
	});
	$("#qrFetchTitle").on("change", setDoiMetaPermissions);
	$("#qrSizeInput").on("change input", dbQrSizeSave);
	$("#qrManualTitle").on("change", toggleTitleFetch);

	chrome.tabs.getCurrent(function(tab) {
		chrome.runtime.sendMessage({cmd: "record_tab_id", id: tab.id});
	});
}

function toggleBgColor() {
	if ($("#qrBgTrans").prop('checked')) {
		$("#bgColorDiv").css("display", "none");
	} else {
		$("#bgColorDiv").css("display", "block");
	}
}

function qrSizeSave() {
	var qrSize = parseInt($("#qrSizeInput").val());
	if (isNaN(qrSize)) {
		$("#qrSizeInput").val(300);
		qrSize = 300;
	} else if (qrSize < 80) {
		$("#qrSizeInput").val(80);
		qrSize = 80;
	}

	storage.area.get(["qr_size"], function(stg) {
		if (parseInt(stg.qr_size) !== qrSize) {
			saveOptions();
		}
	});
}

// Read a page's GET URL variables and return them as an associative array.
// http://jquery-howto.blogspot.com/2009/09/get-url-parameters-values-with-jquery.html
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
		$("#doiInput").val(initDOI);
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
			$("#qrSizeInput").val(300);
		} else if (qrSize < 80) {
			$("#qrSizeInput").val(80);
		} else {
			$("#qrSizeInput").val(qrSize);
		}

		if (stgLocal.qr_title === true) {
			$("#qrFetchTitle").prop("checked", true);
		}
		if (stg.qr_bgtrans === true) {
			$("#qrBgTrans").prop("checked", true);
			$("#bgColorDiv").css("display", "none");
		}
	});
	});
}

function populateHistory() {
	var stgFetch = [
		"recorded_dois",
		"history_showsave"
	];

	storage.area.get(stgFetch, function(stg) {
		if (typeof stg.recorded_dois === 'undefined') {
			return;
		}

		// Skip holes in the array (should not occur)
		stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
			// Use !=, not !==, so that null is caught as well
			return elm != undefined;
		});

		var optionHtml = "";
		var i;
		for (i = 0; i < stg.recorded_dois.length; i++) {
			if (stg.recorded_dois[i].save) {
				optionHtml += '<option value="' + stg.recorded_dois[i].doi + '" />';
			}
		}
		if (stg.history_showsave !== true) {
			for (i = 0; i < stg.recorded_dois.length; i++) {
				if (!stg.recorded_dois[i].save) {
					optionHtml += '<option value="' + stg.recorded_dois[i].doi + '" />';
				}
			}
		}
		$("#doiHistory").html(optionHtml);
	});
}

function recordDoi(doiInput) {
	chrome.runtime.sendMessage({
		cmd: "record_doi",
		doi: doiInput
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
		$("#qrFgColorInput").val(qrFgColor);

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
		$("#qrBgColorInput").val(qrBgColor);

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
		qr_bgtrans: $("#qrBgTrans").prop('checked'),
		qr_size: parseInt($("#qrSizeInput").val()),
		qr_fgcolor: $("#qrFgColorInput").val(),
		qr_bgcolor: $("#qrBgColorInput").val(),
		qr_title: $("#qrFetchTitle").prop('checked')
	};

	chrome.storage.local.set(options, null);
}

function toggleTitleFetch() {
	if ($("#qrManualTitle").prop('checked')) {
		$("#qrFetchTitle").prop("checked", false);
		$("#qrFetchTitle").prop("disabled", true);
		$("#qrManualTitleTextDiv").css("display", "flex");
		saveOptions();
	} else {
		$("#qrFetchTitle").prop("disabled", false);
		$("#qrManualTitleTextDiv").css("display", "none");
	}
}

function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

function checkValidDoi(doiInput) {
	if (!doiInput) {
		return false;
	} else if (/^10\./.test(doiInput)) {
		return true;
	} else if (/^10\//.test(doiInput)) {
		return true;
	} else {
		simpleNotification(chrome.i18n.getMessage("invalidDoiAlert"));
		return false;
	}
}

function resetSpace() {
	$("#notifyDiv").html("");
	$("#notifyDiv").css("display", "none");
	$("#qrDiv").html("");
	$("#qrDiv").css("display", "none");
}

function simpleNotification(message) {
	resetSpace();
	$("#notifyDiv").html(message);
	$("#notifyDiv").css("display", "block");
}

function advancedNotification(elms) {
	resetSpace();
	for (var i = 0; i < elms.length; i++) {
		elms[i].appendTo($("#notifyDiv"));
	}
	$("#notifyDiv").css("display", "block");
}

function setDoiMetaPermissions() {
	var perm = $("#qrFetchTitle").prop('checked');

	if (perm) {
		chrome.permissions.request({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(granted) {
			if (granted) {
				$("#qrFetchTitle").prop("checked", true);
				saveOptions();
			} else {
				$("#qrFetchTitle").prop("checked", false);
				saveOptions();
			}
		});
	} else {
		chrome.permissions.remove({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(removed) {
			if (removed) {
				$("#qrFetchTitle").prop("checked", false);
				saveOptions();
			} else {
				$("#qrFetchTitle").prop("checked", true);
				saveOptions();
			}
		});
	}
}

function htmlEscape(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function formSubmitHandler() {
	var doiInput = encodeURI(trim($("#doiInput").val()));
	var qrSize = parseInt($("#qrSizeInput").val());
	var fgcolor = $("#qrFgColorInput").val();
	var bgcolor = $("#qrBgColorInput").val();

	if ($("#qrBgTrans").prop('checked')) {
		bgcolor = null;
	}

	if (isNaN(qrSize)) {
		$("#qrSizeInput").val(300);
		qrSize = 300;
	} else if (qrSize < 80) {
		$("#qrSizeInput").val(80);
		qrSize = 80;
	}

	if (!checkValidDoi(doiInput)) {
		return;
	}

	recordDoi(doiInput);
	insertQr(doiInput, qrSize, fgcolor, bgcolor);
}

function insertQr(doiInput, size, fgcolor, bgcolor) {
	resetSpace();

	var stringToEncode = "";
	var jsonUrl = "http://dx.doi.org/" + doiInput;

	if (/^10\./.test(doiInput)) {
		stringToEncode = "http://dx.doi.org/" + doiInput;
	} else if (/^10\//.test(doiInput)) {
		stringToEncode = "http://doi.org/" + doiInput.replace(/^10\//,"");
	}

	simpleNotification("Loading...");

	var perm = $("#qrFetchTitle").prop('checked');
	if (perm) {
		chrome.permissions.request({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(granted) {
			if (granted) {
				var jqxhr = $.ajax({
					url: jsonUrl,
					headers: { Accept: "application/citeproc+json" },
					dataType: "text",
					type: "GET",
					cache: false
				});
				jqxhr.done(function() {
					try {
						var doiTitle = JSON.parse(jqxhr.responseText).title;
						doiTitle = doiTitle.replace(/<subtitle>(.*)<\/subtitle>/," - $1");
						doiTitle = doiTitle.replace(/<alt-title>(.*)<\/alt-title>/,"");
						doiTitle = doiTitle.replace(/<.*>(.*)<\/.*>/,"$1");
						stringToEncode = doiTitle + "\n" + stringToEncode;
						updateMessage(stringToEncode, "found");
						createQrImage(stringToEncode, size, fgcolor, bgcolor);
					} catch(e) {
						updateMessage(stringToEncode, "missing");
						createQrImage(stringToEncode, size, fgcolor, bgcolor);
					}
				});
				jqxhr.fail(function() {
					updateMessage(stringToEncode, "missing");
					createQrImage(stringToEncode, size, fgcolor, bgcolor);
				});
			} else {
				updateMessage(stringToEncode, "disabled");
				createQrImage(stringToEncode, size, fgcolor, bgcolor);
			}
		});
	} else {
		var manualTitle = $("#qrManualTitle").prop('checked');
		if (manualTitle) {
			var titleString = $("#qrManualTitleText").val();
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
	var tmp = $('<span>').attr("class", "notifyHeading");
	tmp.html(chrome.i18n.getMessage("qrTitleStatus"));
	statusMessage.push(tmp);
	tmp = $('<span>').attr("class", "notifyContent");
	tmp.html(titleNotice);
	statusMessage.push(tmp);
	tmp = $('<br>');
	statusMessage.push(tmp);
	tmp = $('<span>').attr("class", "notifyHeading");
	tmp.html(chrome.i18n.getMessage("qrMessageEncoded"));
	statusMessage.push(tmp);
	tmp = $('<span>').attr("class", "notifyContent");
	tmp.html(htmlEscape(stringToEncode));
	statusMessage.push(tmp);

	advancedNotification(statusMessage);
}

function linkifyQrImage() {
	var qrImg = $("#qrDiv img");
	if (qrImg.length > 0) {
		var saveLink = $('<a>').attr("id", "qrImageSaveLink");
		saveLink.attr("href", qrImg.attr("src"));
		saveLink.attr("download", "qrImage.png");
		qrImg.wrap(saveLink);
		$("#qrDiv").css("display", "block");
	}
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("qrHeading");
	$("#heading").html(message);
	message = chrome.i18n.getMessage("qrSubHeading");
	$("#subHeading").html(message);
	message = chrome.i18n.getMessage("qrFgColorInputLabel");
	$("#qrFgColorInputLabel").html(message);
	message = chrome.i18n.getMessage("qrBgColorInputLabel");
	$("#qrBgColorInputLabel").html(message);
	message = chrome.i18n.getMessage("qrBgTransLabel");
	$("#qrBgTransLabel").html(message);
	message = chrome.i18n.getMessage("qrSizeInputLabel");
	$("#qrSizeInputLabel").html(message);
	message = chrome.i18n.getMessage("qrManualTitleLabel");
	$("#qrManualTitleLabel").html(message);
	message = chrome.i18n.getMessage("qrManualTitleTextLabel");
	$("#qrManualTitleTextLabel").html(message);
	message = chrome.i18n.getMessage("qrFetchTitleLabel");
	$("#qrFetchTitleLabel").html(message);
}

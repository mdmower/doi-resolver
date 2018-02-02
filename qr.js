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
	initializeDoiInput();
	restoreOptions();
	prepareColorPickers();
	populateHistory();
	startListeners();
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

function growFormColumns() {
	var left = document.getElementById("leftForm");
	var right = document.getElementById("colorParams");
	if (left.offsetHeight < right.offsetHeight) {
		left.style.height = right.offsetHeight + "px";
	}
}

function startListeners() {
	/*
	 * qrSizeInput and qrBorderInput can fire onChange events frequently.
	 * debounce them to only run once per 750ms so Chrome Sync doesn't
	 * get too many sync requests.
	 */
	var dbQrDimensionsSave = debounce(qrDimensionsSave, 750);

	document.getElementById("doiForm").addEventListener("submit", function (event) {
		formSubmitHandler();
		event.preventDefault();
	});
	document.getElementById("qrBgTrans").addEventListener("change", function () {
		toggleBgColor();
		saveOptions();
	});
	Array.from(document.querySelectorAll('input[name="qrImageType"]')).forEach(function(elm) {
		elm.addEventListener("click", saveOptions);
	});
	document.getElementById("qrFetchTitle").addEventListener("change", setDoiMetaPermissions);
	document.getElementById("qrSizeInput").addEventListener("input", dbQrDimensionsSave);
	document.getElementById("qrBorderInput").addEventListener("input", dbQrDimensionsSave);
	document.getElementById("qrManualTitle").addEventListener("change", toggleTitleFetch);

	var dbSaveOptions = debounce(saveOptions, 500);
	var dbColorSave = function () {
		if (isHexColor(this.value)) {
			this.classList.remove("badColor");
			if (this.id === "qrFgColorInput" && colorPickerStorage.fgColorPicker) {
				colorPickerStorage.fgColorPicker.off("color:change", colorPickerStorage.debounceFgColorChanged);
				colorPickerStorage.fgColorPicker.color.hexString = this.value;
				this.style.background = "linear-gradient(90deg, #FFF 50%, " + this.value + " 50%)";
				colorPickerStorage.fgColorPicker.on("color:change", colorPickerStorage.debounceFgColorChanged);
			} else if (this.id === "qrBgColorInput" && colorPickerStorage.bgColorPicker) {
				colorPickerStorage.bgColorPicker.off("color:change", colorPickerStorage.debounceBgColorChanged);
				colorPickerStorage.bgColorPicker.color.hexString = this.value;
				this.style.background = "linear-gradient(90deg, #FFF 50%, " + this.value + " 50%)";
				colorPickerStorage.bgColorPicker.on("color:change", colorPickerStorage.debounceBgColorChanged);
			}
			dbSaveOptions();
		} else {
			this.classList.add("badColor");
		}
	};
	document.getElementById("qrFgColorInput").addEventListener("input", dbColorSave);
	document.getElementById("qrBgColorInput").addEventListener("input", dbColorSave);

	chrome.tabs.getCurrent(function(tab) {
		var tabRecord = chrome.extension.getBackgroundPage().tabRecord;
		tabRecord(tab.id, true);
	});
}

function toggleBgColor(transparency) {
	if (transparency === undefined)
		transparency = document.getElementById("qrBgTrans").checked;
	document.getElementById("qrBgColorInput").disabled = transparency;
	document.getElementById("qrBgColorPicker").style["pointer-events"] = transparency ? "none" : "auto";
}

function qrDimensionsSave() {
	var qrSizeElm = document.getElementById("qrSizeInput");
	var qrSize = Number(qrSizeElm.value);
	if (isNaN(qrSize)) {
		qrSizeElm.value = 300;
		qrSize = 300;
	} else if (qrSize < 80) {
		qrSizeElm.value = 80;
		qrSize = 80;
	}

	var qrBorderElm = document.getElementById("qrBorderInput");
	var qrBorder = Number(qrBorderElm.value);
	if (isNaN(qrBorder)) {
		qrBorderElm.value = 0;
		qrBorder = 0;
	} else if (qrSize < 0) {
		qrBorderElm.value = 0;
		qrBorder = 0;
	}

	storage.area.get(["qr_size", "qr_border"], function(stg) {
		if (Number(stg.qr_size) !== qrSize || Number(stg.qr_border) !== qrBorder) {
			saveOptions();
		}
	});
}

function queryStringToJSON(query) {
	if (!query) {
		return {};
	}

	var result = {};
	var pairs = query.slice(1).split('&');
	pairs.forEach(function(pair) {
		pair = pair.split('=');
		result[pair[0]] = decodeURIComponent(pair[1] || '');
	});

	return JSON.parse(JSON.stringify(result));
}

function initializeDoiInput() {
	document.getElementById("doiInput").value = queryStringToJSON(location.search).doi || '';
}

function restoreOptions() {
	var stgFetch = [
		"qr_size",
		"qr_border",
		"qr_imgtype",
		"qr_bgtrans"
	];

	chrome.storage.local.get(["qr_title"], function(stgLocal) {
	storage.area.get(stgFetch, function(stg) {
		var qrSize = Number(stg.qr_size);
		if (isNaN(qrSize)) {
			document.getElementById("qrSizeInput").value = 300;
		} else if (qrSize < 80) {
			document.getElementById("qrSizeInput").value = 80;
		} else {
			document.getElementById("qrSizeInput").value = qrSize;
		}

		var qrBorder = Number(stg.qr_border);
		if (isNaN(qrBorder) || qrBorder < 0) {
			document.getElementById("qrBorderInput").value = 0;
		} else {
			document.getElementById("qrBorderInput").value = qrBorder;
		}

		if (stg.qr_imgtype === "png") {
			document.getElementById("qrImageTypePng").checked = true;
		} else {
			document.getElementById("qrImageTypeSvg").checked = true;
		}
		document.getElementById("qrFetchTitle").checked = Boolean(stgLocal.qr_title);
		document.getElementById("qrBgTrans").checked = Boolean(stg.qr_bgtrans);
		toggleBgColor(Boolean(stg.qr_bgtrans));
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
	return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(code);
}

function colorChanged(color, changes) {
	this.value = color.hexString;
	this.style.background = "linear-gradient(90deg, #FFF 50%, " + color.hexString + " 50%)";
	saveOptions();
}

var colorPickerStorage = {
	fgColorPicker: undefined,
	bgColorPicker: undefined,
	debounceFgColorChanged: undefined,
	debounceBgColorChanged: undefined
};

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
		var qrFgColorInput = document.getElementById("qrFgColorInput");
		qrFgColorInput.value = qrFgColor;
		qrFgColorInput.style.background = "linear-gradient(90deg, #FFF 50%, " + qrFgColor + " 50%)";

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
		var qrBgColorInput = document.getElementById("qrBgColorInput");
		qrBgColorInput.value = qrBgColor;
		qrBgColorInput.style.background = "linear-gradient(90deg, #FFF 50%, " + qrBgColor + " 50%)";

		var colorPickerOptions = {
			padding: 4,
			markerRadius: 6,
			sliderMargin: 12,
			width: 160,
			height: 160
		};

		colorPickerOptions.color = qrFgColor;
		colorPickerStorage.fgColorPicker = new iro.ColorPicker("#qrFgColorPicker", colorPickerOptions);
		colorPickerStorage.debounceFgColorChanged = debounce(colorChanged.bind(qrFgColorInput), 500);
		colorPickerStorage.fgColorPicker.on("color:change", colorPickerStorage.debounceFgColorChanged);

		colorPickerOptions.color = qrBgColor;
		colorPickerStorage.bgColorPicker = new iro.ColorPicker("#qrBgColorPicker", colorPickerOptions);
		colorPickerStorage.debounceBgColorChanged = debounce(colorChanged.bind(qrBgColorInput), 500);
		colorPickerStorage.bgColorPicker.on("color:change", colorPickerStorage.debounceBgColorChanged);

		growFormColumns();
	});
}

function saveOptions() {
	var options = {
		qr_bgtrans: document.getElementById("qrBgTrans").checked,
		qr_size: Number(document.getElementById("qrSizeInput").value),
		qr_border: Number(document.getElementById("qrBorderInput").value),
		qr_fgcolor: document.getElementById("qrFgColorInput").value,
		qr_bgcolor: document.getElementById("qrBgColorInput").value,
		qr_imgtype: document.querySelector('input[name="qrImageType"]:checked').value,
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
	var qrBorder = Number(document.getElementById("qrBorderInput").value);
	var fgcolor = document.getElementById("qrFgColorInput").value;
	var bgcolor = document.getElementById("qrBgColorInput").value;
	var imgType = document.querySelector('input[name="qrImageType"]:checked').value;

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

	if (isNaN(qrBorder) || qrBorder < 0) {
		document.getElementById("qrBorderInput").value = 0;
		qrBorder = 0;
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

	var qrParms = {
		size: qrSize,
		border: qrBorder,
		fgcolor: fgcolor,
		bgcolor: bgcolor,
		imgType: imgType
	};

	insertQr(doiInput, qrParms);
}

function insertQr(doiInput, qrParms) {
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
						qrParms.text = stringToEncode;
						createQrImage(qrParms);
					} catch(ex) {
						updateMessage(stringToEncode, "missing");
						qrParms.text = stringToEncode;
						createQrImage(qrParms);
					}
				})
				.catch(function(error) {
					updateMessage(stringToEncode, "missing");
					qrParms.text = stringToEncode;
					createQrImage(qrParms);
				});
			} else {
				updateMessage(stringToEncode, "disabled");
				qrParms.text = stringToEncode;
				createQrImage(qrParms);
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
		qrParms.text = stringToEncode;
		createQrImage(qrParms);
	}
}

function createQrImage(qrParms) {
	var segs = qrcodegen.QrSegment.makeSegments(qrParms.text);
	var ecl = qrcodegen.QrCode.Ecc.MEDIUM;
	var minVer = 1;
	var maxVer = 40;
	var mask = -1;
	var boostEcc = true;
	var qr = qrcodegen.QrCode.encodeSegments(segs, ecl, minVer, maxVer, mask, boostEcc);
	var code = qr.toSvgString(qrParms.border);

	var domParser = new DOMParser();
	var svgDoc = domParser.parseFromString(code, "text/xml");
	var svg = svgDoc.getElementsByTagName("svg")[0];

	if (qrParms.bgcolor === null) {
		svg.getElementsByTagName("rect")[0].setAttribute("fill-opacity", "0.0");
		svg.getElementsByTagName("rect")[0].setAttribute("fill", "#ffffff");
	} else {
		svg.getElementsByTagName("rect")[0].setAttribute("fill", qrParms.bgcolor);
	}
	svg.getElementsByTagName("path")[0].setAttribute("fill", qrParms.fgcolor);
	svg.setAttribute("width", qrParms.size);
	svg.setAttribute("height", qrParms.size);

	var dataUrl = "";
	if (qrParms.imgType === "png") {
		var canvas = document.createElement("canvas");
		canvg(canvas, svg.outerHTML, {log: true});
		document.getElementById("qrDiv").appendChild(canvas);
		dataUrl = canvas.toDataURL("image/png");
	} else {
		document.getElementById("qrDiv").appendChild(svg);
		dataUrl = "data:image/svg+xml;utf8," + encodeURIComponent(svg.outerHTML);
	}
	linkifyQrImage(qrParms.imgType, dataUrl);
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

function linkifyQrImage(imgType, dataUrl) {
	var qrDiv = document.getElementById("qrDiv");
	if (qrDiv === null) {
		return;
	}
	var qrImg = qrDiv.firstChild;
	if (qrImg === null) {
		return;
	}

	var saveLink = document.createElement("a");
	saveLink.setAttribute("id", "qrImageSaveLink");
	saveLink.setAttribute("href", dataUrl);
	if (imgType === 'png') {
		saveLink.setAttribute("download", "qrImage.png");
	} else {
		saveLink.setAttribute("download", "qrImage.svg");
	}

	saveLink.appendChild(qrImg);
	qrDiv.appendChild(saveLink);

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
		"qrBorderInputLabel",
		"qrImageTypeLabel",
		"qrSubHeading",
		"submitButton"
	];

	for (var i = 0; i < messageIds.length; i++) {
		message = chrome.i18n.getMessage(messageIds[i]);
		document.getElementById(messageIds[i]).innerHTML = message;
	}
}

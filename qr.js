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
	beginInit();
}, false);

function beginInit() {
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

	document.getElementById("qrSizeInput").addEventListener("input", dbQrDimensionsSave);
	document.getElementById("qrBorderInput").addEventListener("input", dbQrDimensionsSave);
	toggleTitleMessageListeners(true);

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
	if (transparency === undefined) {
		transparency = document.getElementById("qrBgTrans").checked;
	}

	var qrBgColorInput = document.getElementById("qrBgColorInput");
	qrBgColorInput.disabled = transparency;
	document.getElementById("qrBgColorPicker").style.pointerEvents = transparency ? "none" : "auto";

	if (transparency) {
		toggleBgColor.savedStyle = qrBgColorInput.getAttribute("style");
		qrBgColorInput.removeAttribute("style");
		qrBgColorInput.style.color = "transparent";
		qrBgColorInput.style.backgroundImage = "linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)";
		qrBgColorInput.style.backgroundSize = "20px 20px";
		qrBgColorInput.style.backgroundPosition = "0 0, 0 10px, 10px -10px, -10px 0px";
	} else {
		qrBgColorInput.removeAttribute("style");
		if (toggleBgColor.savedStyle) {
			qrBgColorInput.setAttribute("style", toggleBgColor.savedStyle);
		}
	}
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

	chrome.storage.local.get(["qr_size", "qr_border"], function(stg) {
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
		"qr_bgtrans",
		"qr_message",
		"qr_title"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
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

		// If both qr_title and qr_message are true (should not occur),
		// give qr_title precedence
		if (stg.qr_title) {
			document.getElementById("qrFetchTitle").checked = true;
			document.getElementById("qrManualMessage").disabled = true;
		} else if (stg.qr_message) {
			document.getElementById("qrManualMessage").checked = true;
			document.getElementById("qrManualMessageTextDiv").style.display = "flex";
			document.getElementById("qrFetchTitle").disabled = true;
		}

		document.getElementById("qrBgTrans").checked = Boolean(stg.qr_bgtrans);
	});
}

function populateHistory() {
	var stgFetch = [
		"history",
		"recorded_dois",
		"history_showsave",
		"history_showtitles",
		"history_sortby"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
		if (!stg.history || !Array.isArray(stg.recorded_dois)) {
			document.getElementById("openHistory").style.display = "none";
			return;
		}

		// Skip holes in the array (should not occur)
		stg.recorded_dois = stg.recorded_dois.filter(function(elm) {
			// Use !=, not !==, so that null is caught as well
			return elm != undefined;
		});

		var sortHistoryEntries = chrome.extension.getBackgroundPage().sortHistoryEntries;
		sortHistoryEntries(stg.recorded_dois, stg.history_sortby);

		var escapeHtml = chrome.extension.getBackgroundPage().escapeHtml;
		var optionHtml = "";

		stg.recorded_dois.filter(item => item.save).forEach((item) => {
			var label = stg.history_showtitles && item.title ? escapeHtml(item.title) : item.doi;
			optionHtml += '<option class="save" value="' + item.doi + '">' + label + '</option>';
		});
		optionHtml += optionHtml ? "<option disabled></option>" : "";

		if (stg.history_showsave !== true) {
			stg.recorded_dois.filter(item => !item.save).forEach((item) => {
				var label = stg.history_showtitles && item.title ? escapeHtml(item.title) : item.doi;
				optionHtml += '<option value="' + item.doi + '">' + label + '</option>';
			});
		}

		var selectBox = document.getElementById("doiHistory");
		selectBox.setAttribute('size', '12');
		selectBox.selectedIndex = -1;
		selectBox.innerHTML = optionHtml;

		var filterSelectByText = chrome.extension.getBackgroundPage().filterSelectByText;
		var filterInput = function() {
			filterSelectByText(selectBox, this.value, false);
		};

		var filter = document.getElementById("doiInput");
		filter.addEventListener('input', filterInput);

		selectBox.addEventListener('change', function() {
			filter.removeEventListener('input', filterInput);
			filter.value = this.value;
			filter.addEventListener('input', filterInput);
			this.selectedIndex = -1;
			filterSelectByText(selectBox, "", false);
			toggleHistoryBox(false);
		});

		var openHistory = document.getElementById("openHistory");
		openHistory.addEventListener('click', function() {
			toggleHistoryBox(true);
		});

		var closeHistory = document.getElementById("closeHistory");
		closeHistory.addEventListener('click', function() {
			toggleHistoryBox(false);
		});

		var mainForm = document.getElementById("mainForm");
		document.addEventListener('click', function(event) {
			if (!mainForm.contains(event.target)) {
				toggleHistoryBox(false);
			}
		});

		document.getElementById("doiHistory").innerHTML = optionHtml;
	});
}

function historyBoxSize() {
	var inputContainer = document.getElementById('inputContainer');
	var boxTop = inputContainer.offsetTop + inputContainer.offsetHeight + 2;
	var submitButton = document.getElementById('submitButton');
	var boxBottom = submitButton.offsetTop - 2;

	return boxBottom - boxTop;
}

function toggleHistoryBox(enable) {
	var selectBox = document.getElementById("doiHistory");
	if (toggleHistoryBox.boxSize === undefined) {
		toggleHistoryBox.boxSize = historyBoxSize() + 'px';
		selectBox.style.height = toggleHistoryBox.boxSize;
	}
	var openHistory = document.getElementById("openHistory");
	var closeHistory = document.getElementById("closeHistory");
	selectBox.style.display = enable ? "block" : "";
	openHistory.style.display = enable ? "none" : "";
	closeHistory.style.display = enable ? "block" : "";
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
		"qr_bgcolor",
		"qr_bgtrans"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
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

		if (stg.qr_bgtrans) {
			toggleBgColor(true);
		}

		var colorPickerOptions = {
			padding: 4,
			markerRadius: 6,
			sliderMargin: 12,
			width: 180,
			height: 180
		};

		colorPickerOptions.color = qrFgColor;
		colorPickerStorage.fgColorPicker = new iro.ColorPicker("#qrFgColorPicker", colorPickerOptions);
		colorPickerStorage.debounceFgColorChanged = debounce(colorChanged.bind(qrFgColorInput), 500);
		colorPickerStorage.fgColorPicker.on("color:change", colorPickerStorage.debounceFgColorChanged);

		colorPickerOptions.color = qrBgColor;
		colorPickerStorage.bgColorPicker = new iro.ColorPicker("#qrBgColorPicker", colorPickerOptions);
		colorPickerStorage.debounceBgColorChanged = debounce(colorChanged.bind(qrBgColorInput), 500);
		colorPickerStorage.bgColorPicker.on("color:change", colorPickerStorage.debounceBgColorChanged);
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
		qr_message: document.getElementById("qrManualMessage").checked,
		qr_title: document.getElementById("qrFetchTitle").checked
	};

	chrome.storage.local.set(options, null);
}

function toggleTitleMessageListeners(enable) {
	var qrFetchTitle = document.getElementById("qrFetchTitle");
	var qrManualMessage = document.getElementById("qrManualMessage");
	if (enable) {
		qrFetchTitle.addEventListener("change", toggleTitleMessageOptions);
		qrManualMessage.addEventListener("change", toggleTitleMessageOptions);
	} else {
		qrFetchTitle.removeEventListener("change", toggleTitleMessageOptions);
		qrManualMessage.removeEventListener("change", toggleTitleMessageOptions);
	}
}

function toggleTitleMessageOptions(event) {
	toggleTitleMessageListeners(false);

	var qrFetchTitle = document.getElementById("qrFetchTitle");
	var qrManualMessage = document.getElementById("qrManualMessage");
	var qrManualMessageTextDiv = document.getElementById("qrManualMessageTextDiv");

	if (event.target.id === "qrManualMessage") {
		if (qrManualMessage.checked) {
			qrFetchTitle.checked = false;
			qrFetchTitle.disabled = true;
			qrManualMessageTextDiv.style.display = "flex";
		} else {
			qrFetchTitle.disabled = false;
			qrManualMessageTextDiv.style.display = "";
		}
		saveOptions();
		toggleTitleMessageListeners(true);
	} else {
		setDoiMetaPermissions(qrFetchTitle.checked)
		.then((success) => {
			if (qrFetchTitle.checked) {
				if (success) { // Permission successfully added
					qrManualMessage.checked = false;
					qrManualMessage.disabled = true;
					qrManualMessageTextDiv.style.display = "";
					saveOptions();
				} else {
					qrFetchTitle.checked = false;
				}
			} else {
				// Even if permission is not successfully removed,
				// handle option toggling as if it were
				qrManualMessage.disabled = false;
				saveOptions();
			}
			toggleTitleMessageListeners(true);
		});
	}
}

function resetSpace() {
	var notifyDiv = document.getElementById("notifyDiv");
	var qrDiv = document.getElementById("qrDiv");
	notifyDiv.removeAttribute("class");
	notifyDiv.innerHTML = "";
	notifyDiv.style.display = "none";
	qrDiv.innerHTML = "";
	qrDiv.style.display = "none";
}

function simpleNotification(message) {
	resetSpace();
	var notifyDiv = document.getElementById("notifyDiv");
	notifyDiv.innerHTML = message;
	notifyDiv.style.display = "block";
}

function advancedNotification(docFrag) {
	resetSpace();
	var notifyDiv = document.getElementById("notifyDiv");
	notifyDiv.classList.add("advanced");
	notifyDiv.appendChild(docFrag);
	notifyDiv.style.display = "block";
}

function setDoiMetaPermissions(enable) {
	return new Promise((resolve) => {

		if (enable) {
			chrome.permissions.request({
				origins: [
					'https://*.doi.org/',
					'https://*.crossref.org/',
					'https://*.datacite.org/'
				]
			}, resolve);
		} else {
			chrome.permissions.remove({
				origins: [
					'https://*.doi.org/',
					'https://*.crossref.org/',
					'https://*.datacite.org/'
				]
			}, resolve);
		}

	});
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
	var recordDoi = chrome.extension.getBackgroundPage().recordDoi;
	var getSavedDoiTitle = chrome.extension.getBackgroundPage().getSavedDoiTitle;
	var fetchDoiTitle = chrome.extension.getBackgroundPage().fetchDoiTitle;

	if (/^10\./.test(doiInput)) {
		stringToEncode = "https://dx.doi.org/" + doiInput;
	} else if (/^10\//.test(doiInput)) {
		stringToEncode = "https://doi.org/" + doiInput.replace(/^10\//,"");
	}

	simpleNotification("Loading...");

	if (document.getElementById("qrFetchTitle").checked) {
		getSavedDoiTitle(doiInput)
		.then(function(title) {
			if (title) {
				console.log("Found title in history");
				stringToEncode = title + "\n" + stringToEncode;
				updateMessage(stringToEncode, "found");
				qrParms.text = stringToEncode;
				createQrImage(qrParms);
				return;
			}

			chrome.permissions.request({
				origins: [
					'https://*.doi.org/',
					'https://*.crossref.org/',
					'https://*.datacite.org/'
				]
			}, function(granted) {
				if (granted) {
					console.log("Fetching title from network");
					fetchDoiTitle(doiInput)
					.then(function(title) {
						if (title) {
							stringToEncode = title + "\n" + stringToEncode;
							updateMessage(stringToEncode, "found");
						} else {
							updateMessage(stringToEncode, "missing");
						}
						qrParms.text = stringToEncode;
						createQrImage(qrParms);

						recordDoi(doiInput, title)
						.catch((errMsg) => {
							console.log(errMsg);
						});
					})
					.catch(function(error) {
						console.error("Error while fetching title", error);
						updateMessage(stringToEncode, "missing");
						qrParms.text = stringToEncode;
						createQrImage(qrParms);

						recordDoi(doiInput)
						.catch((errMsg) => {
							console.log(errMsg);
						});
					});
				} else {
					console.log("Permissions not granted for title fetch");
					updateMessage(stringToEncode, "disabled");
					qrParms.text = stringToEncode;
					createQrImage(qrParms);

					recordDoi(doiInput)
					.catch((errMsg) => {
						console.log(errMsg);
					});
				}
			});
		});
	} else {
		if (document.getElementById("qrManualMessage").checked) {
			var titleString = document.getElementById("qrManualMessageText").value;
			if (titleString !== "") {
				stringToEncode = titleString + "\n" + stringToEncode;
			}
		}
		updateMessage(stringToEncode, "disabled");
		qrParms.text = stringToEncode;
		createQrImage(qrParms);

		chrome.extension.getBackgroundPage().recordDoiAction(doiInput);
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

	var template = document.getElementById("notify_template");

	var clone = document.importNode(template.content, true);
	var headings = clone.querySelectorAll('.notifyHeading');
	var contents = clone.querySelectorAll('.notifyContent');

	headings[0].innerHTML = chrome.i18n.getMessage("qrTitleStatus");
	contents[0].innerHTML = titleNotice;
	headings[1].innerHTML = chrome.i18n.getMessage("qrMessageEncoded");
	contents[1].innerHTML = stringToEncode;

	advancedNotification(clone);
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
		"qrManualMessageLabel",
		"qrManualMessageTextLabel",
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

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
	initializeDoiInput();
	getLocalMessages();
	initSelections();
	populateHistory();
	startListeners();
}

function startListeners() {
	document.getElementById("citeForm").addEventListener("submit", function (event) {
		formSubmitHandler();
		event.preventDefault();
	});

	chrome.tabs.getCurrent(function(tab) {
		var tabRecord = chrome.extension.getBackgroundPage().tabRecord;
		tabRecord(tab.id, true);
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

function getLocales() {
	return fetch("csl_locales/locales.json")
	.then(function(response) {
		return response.json();
	})
	.catch(function(error) {
		console.error("Unable to read locales", error);
		return {"primary-dialects": {"en": "en-US"}, "language-names": {"en-US": ["English (US)", "English (US)"]}};
	});
}

function getStyles() {
	return fetch("/cite_styles.json")
	.then(function(response) {
		return response.json();
	})
	.catch(function(error) {
		console.error("Unable to read styles", error);
		return {"cite_styles": [{"code": "bibtex", "title": "BibTeX generic citation style", "default_locale": "en-US"}]};
	});
}

function initSelections() {
	var localesPromise = getLocales();
	var stylesPromise = getStyles();

	Promise.all([localesPromise, stylesPromise])
	.then(function(response) {
		var locales = response[0];
		var styles = response[1];
		buildSelections(locales, styles);
	});
}

function buildSelections(cslLocales, cslStyles) {
	var stgFetch = [
		"cite_locale",
		"cite_style"
	];

	chrome.storage.local.get(stgFetch, function(stg) {
		var storedLocale = stg.cite_locale;
		var storedStyle = stg.cite_style;
		var allLocales = Object.values(cslLocales["primary-dialects"]);
		var allStyles = cslStyles.cite_styles;

		if (allLocales.indexOf(storedLocale) < 0) {
			storedLocale = "auto";
			chrome.storage.local.set({cite_locale: "auto"}, null);
		}

		/* TODO: Offer option to display locales in their native language;
		   Retrieved with localesMap[allLocales[i]][0]] */
		var localesMap = cslLocales["language-names"];
		var readableLocales = [];
		for (var i = 0; i < allLocales.length; i++) {
			readableLocales[i] = [allLocales[i], localesMap[allLocales[i]][1]];
		}

		readableLocales.sort( function( a, b ) {
			if (a[1] == b[1]) {
				return 0;
			}
			return a[1] < b[1] ? -1 : 1;
		});

		function generateOption(value, html, selected, defaultLocale) {
			var option = document.createElement("option");
			option.setAttribute("value", value);
			option.innerHTML = html;
			if (selected) {
				option.setAttribute("selected", "");
			}
			if (defaultLocale) {
				option.setAttribute("data-locale", defaultLocale);
			}
			return option;
		}

		var localeOption = generateOption("auto", "Auto", "auto" === storedLocale);
		var citeLocaleInput = document.getElementById("citeLocaleInput");
		citeLocaleInput.appendChild(localeOption);

		readableLocales.forEach(function(readableLocale) {
			localeOption = generateOption(readableLocale[0], readableLocale[1], readableLocale[0] === storedLocale);
			citeLocaleInput.appendChild(localeOption);
		});

		var allStyleCodes = Array.from(allStyles, function(item) {
			return item.code;
		});

		// Style not found or "other" (migration)
		if (allStyleCodes.indexOf(storedStyle) < 0) {
			storedStyle = chrome.extension.getBackgroundPage().getDefaultOption("cite_style");
			chrome.storage.local.set({cite_style: storedStyle}, null);
		}

		var styleList = document.getElementById("styleList");
		allStyles.forEach(function(style) {
			var styleOption = generateOption(style.code, style.title, style.code === storedStyle, style.default_locale);
			styleList.appendChild(styleOption);
		});

		if (styleList.selectedOptions.length > 0) {
			styleList.selectedOptions[0].scrollIntoView();
		}

		var filter = document.getElementById("citeStyleFilter");
		var filterSelectByText = chrome.extension.getBackgroundPage().filterSelectByText;
		filter.addEventListener('input', function() {
			filterSelectByText(styleList, this.value, true);
		});
	});
}

function setDoiMetaPermissions(enable) {
	return new Promise((resolve) => {
		if (enable === undefined) {
			var stgFetch = [
				"history",
				"history_fetch_title"
			];

			chrome.storage.local.get(stgFetch, function(stg) {
				resolve(stg.history === true && stg.history_fetch_title === true);
			});
		} else {
			resolve(enable);
		}
	})
	.then(function(enable) {
		return new Promise((resolve) => {
			if (enable) {
				chrome.permissions.request({
					origins: [
						"https://*.doi.org/",
						"https://*.crossref.org/",
						"https://*.datacite.org/",
						"https://*.medra.org/"
					]
				}, resolve);
			} else {
				chrome.permissions.remove({
					origins: [
						"https://*.doi.org/",
						"https://*.crossref.org/",
						"https://*.datacite.org/",
						"https://*.medra.org/"
					]
				}, resolve);
			}
		});
	});
}

function formSubmitHandler() {
	var trim = chrome.extension.getBackgroundPage().trim;
	var doi = encodeURI(trim(document.getElementById("doiInput").value));

	if (!document.getElementById("styleList").value) {
		return;
	}

	var checkValidDoi = chrome.extension.getBackgroundPage().checkValidDoi;
	if (!checkValidDoi(doi)) {
		simpleNotification(chrome.i18n.getMessage("invalidDoiAlert"));
		return;
	}

	// Allow DOI recording to happen asynchronously
	var recordDoiAction = chrome.extension.getBackgroundPage().recordDoiAction;
	setDoiMetaPermissions()
	.then(function () {
		return recordDoiAction(doi);
	});

	saveSelections();
	getCitation(doi);
}

function saveSelections() {
	var options = {
		cite_style: document.getElementById("styleList").value,
		cite_locale: document.getElementById("citeLocaleInput").value
	};

	chrome.storage.local.set(options, null);
}

function resetSpace() {
	var notifyDiv = document.getElementById("notifyDiv");
	notifyDiv.innerHTML = "";
	notifyDiv.style.display = "none";
	var citeDiv = document.getElementById("citeDiv");
	citeDiv.innerHTML = "";
	citeDiv.style.display = "none";
}

function simpleNotification(message) {
	resetSpace();
	var notifyDiv = document.getElementById("notifyDiv");
	notifyDiv.innerHTML = message;
	notifyDiv.style.display = "block";
}

function outputCitation(message) {
	resetSpace();
	var citeDiv = document.getElementById("citeDiv");
	citeDiv.innerHTML = message;
	citeDiv.style.display = "block";
}

function getCitation(doi) {
	var styleList = document.getElementById("styleList");
	var style = styleList.value;
	var locale = document.getElementById("citeLocaleInput").value;
	var defaultLocale = styleList.selectedOptions[0].getAttribute('data-locale');
	var forceLocale = true;

	if (!style || !locale) {
		return;
	}

	simpleNotification(chrome.i18n.getMessage("loading"));

	// Permissions will be cleaned when last QR/Citation tab is closed
	chrome.permissions.request({
		origins: [
			'https://*.doi.org/',
			'https://*.crossref.org/',
			'https://*.datacite.org/',
			"https://*.medra.org/",
			'https://raw.githubusercontent.com/'
		]
	}, function(granted) {
		if (granted) {
			if (locale === "auto") {
				// Default to en-US in case a defaultLocale is not defined
				locale = defaultLocale || "en-US";
				forceLocale = false;
			}

			var citeprocJsonPromise = getCiteProcJson(doi)
			.catch(function(error) {
				console.timeEnd("Citeproc JSON download");
				console.log("Unable to find citation JSON.", error);
				simpleNotification(chrome.i18n.getMessage("noCitationFound"));
			});

			var styleCslPromise = getStyleCsl(style)
			.catch(function(error) {
				console.timeEnd("Style CSL download");
				console.error("Unable to find style CSL", error);
				simpleNotification(chrome.i18n.getMessage("citeStyleLoadFailP1") + style + chrome.i18n.getMessage("citeStyleLoadFailP2"));
			});

			var localeXmlPromise = getLocaleXml(locale)
			.catch(function(error) {
				console.timeEnd("Locale XML download");
				console.error("Unable to find locale XML", error);
				simpleNotification(chrome.i18n.getMessage("citeLocaleLoadFailP1") + locale + chrome.i18n.getMessage("citeLocaleLoadFailP2"));
			});

			Promise.all([citeprocJsonPromise, styleCslPromise, localeXmlPromise])
			.then(function(response) {
				var cjsResponse = response[0];
				var cslResponse = response[1];
				var locResponse = response[2];

				if (!cjsResponse) {
					console.error("Invalid Citeproc JSON");
					simpleNotification(chrome.i18n.getMessage("noCitationFound"));
					return;
				}

				if (!cslResponse) {
					console.error("Invalid style XML");
					simpleNotification(chrome.i18n.getMessage("citeStyleLoadFailP1") + style + chrome.i18n.getMessage("citeStyleLoadFailP2"));
					return;
				}

				if (!locResponse) {
					console.error("Invalid locale XML");
					simpleNotification(chrome.i18n.getMessage("citeLocaleLoadFailP1") + locale + chrome.i18n.getMessage("citeLocaleLoadFailP2"));
					return;
				}

				renderBib(cjsResponse, cslResponse, locResponse, locale, forceLocale);
			});
		} else {
			simpleNotification(chrome.i18n.getMessage("needCitationPerm"));
		}
	});
}

function getCiteProcJson(doi) {
	var getDefaultResolver = chrome.extension.getBackgroundPage().getDefaultResolver;

	var headers = new Headers();
	headers.append("Accept", "application/vnd.citationstyles.csl+json");

	var init = {
		method: 'GET',
		headers: headers
	};

	var request = new Request(getDefaultResolver() + doi, init);

	console.time("Citeproc JSON download");
	return fetch(request)
	.then(function(response) {
		console.timeEnd("Citeproc JSON download");
		return response.json();
	});
}

function getStyleCsl(filename) {
	console.time("Style CSL download");
	return fetch("https://raw.githubusercontent.com/citation-style-language/styles/master/" + filename + ".csl")
	.then(function(response) {
		console.timeEnd("Style CSL download");
		return response.text();
	});
}

function getLocaleXml(locale) {
	console.time("Locale XML download");
	return fetch("https://raw.githubusercontent.com/citation-style-language/locales/master/locales-" + locale + ".xml")
	.then(function(response) {
		console.timeEnd("Locale XML download");
		return response.text();
	});
}

function renderBib(cjsResponse, cslResponse, locResponse, locale, forceLocale) {
	cjsResponse.id = "Item-1";
	var citations = { "Item-1": cjsResponse };

	var citeprocSys = {
		retrieveLocale: function(/* locale */) {
			return locResponse;
		},
		retrieveItem: function(id) {
			return citations[id];
		}
	};

	var citeproc;
	if (forceLocale) {
		citeproc = new CSL.Engine(citeprocSys, cslResponse, locale, forceLocale);
	} else {
		citeproc = new CSL.Engine(citeprocSys, cslResponse);
	}

	var itemIDs = [];
	for (var key in citations) {
		if (Object.prototype.hasOwnProperty.call(citations, key)) {
			itemIDs.push(key);
		}
	}
	citeproc.updateItems(itemIDs);

	var bibResult = citeproc.makeBibliography();
	if (bibResult) {
		outputCitation(bibResult[1].join('\n'));
	} else {
		simpleNotification(chrome.i18n.getMessage("citeStyleGenFail"));
	}
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
		stg.recorded_dois = stg.recorded_dois.filter(function(recorded_doi) {
			return Boolean(recorded_doi);
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
		selectBox.setAttribute('size', '15');
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
	var submitContainer = document.getElementById('localSubmitContainer');
	var boxBottom = submitContainer.offsetTop - 2;

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

function getLocalMessages() {
	var message = chrome.i18n.getMessage("citeHeading");
	document.title = message;

	var messageIds = [
		"doiInputLabel",
		"citeHeading",
		"citeLocaleLabel",
		"citeStyleFilterLabel",
		"citeSubHeading",
		"submitButton"
	];

	for (var i = 0; i < messageIds.length; i++) {
		message = chrome.i18n.getMessage(messageIds[i]);
		document.getElementById(messageIds[i]).innerHTML = message;
	}
}

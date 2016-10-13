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
		if (stg["sync_data"] === true) {
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
	getUrlVariables();
	getLocalMessages();
	initLocales(true, buildSelections);
	startListeners();
}

function startListeners() {
	$('#citeForm').submit(function () {
		formSubmitHandler();
		return false;
	});
	$('#copyButton').on("click", copyCitation);

	chrome.tabs.getCurrent(function(tab) {
		chrome.runtime.sendMessage({cmd: "record_tab_id", id: tab.id});
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

	var initDOI = vars["doi"];
	if (initDOI) {
		$("#doiInput").val(initDOI);
	}
}

function initLocales(needsMap, callback) {
	if (!callback || typeof(callback) !== "function") {
		return;
	}

	var args = [].slice.call(arguments, 2);

	$.getJSON("csl_locales/locales.json")
	.done(function(data) {
		var langList = $.map(data["primary-dialects"], function(el) {
			return el;
		});

		args.push(langList);
		if (needsMap) {
			args.push(data["language-names"]);
		}

		callback.apply(null, args);
	})
	.fail(function() {
		args.push(["en-US"]);
		if (needsMap) {
			args.push({"en-US": ["English (US)", "English (US)"]});
		}

		callback.apply(null, args);
	});
}

function buildSelections(allLocales, localesMap) {
	var stgFetch = [
		"cite_locale",
		"cite_style"
	];

	storage.area.get(stgFetch, function(stg) {
		var storedLocale = stg["cite_locale"];
		var storedStyle = stg["cite_style"];

		if (allLocales.indexOf(storedLocale) < 0) {
			storedLocale = "auto";
			chrome.storage.local.set({cite_locale: "auto"}, null);
		}

		/* To do: Offer option to display locales in their native language;
		   Retrieved with localesMap[allLocales[i]][0]] */
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

		var localeHtmlOptions = $('<option>').attr("value", "auto").html("Auto");
		if ("auto" === storedLocale) {
			localeHtmlOptions.attr("selected", "selected");
		}

		localeHtmlOptions.appendTo("#citeLocaleInput");

		for (i = 0; i < allLocales.length; i++) {
			localeHtmlOptions = $('<option>').attr("value", readableLocales[i][0]).html(readableLocales[i][1]);
			if (readableLocales[i][0] === storedLocale) {
				localeHtmlOptions.attr("selected", "selected");
			}
			localeHtmlOptions.appendTo("#citeLocaleInput");
		}

		// Style not found or "other" (migration)
		if (allStyleCodes.indexOf(storedStyle) < 0) {
			storedStyle = "bibtex";
			chrome.storage.local.set({cite_style: "bibtex"}, null);
		}

		var styleHtmlOptions;
		for (i = 0; i < allStyleCodes.length; i++) {
			styleHtmlOptions = $('<option>').attr("value", allStyleCodes[i]);
			styleHtmlOptions.html(allStyleTitles[i]);
			if (allStyleCodes[i] === storedStyle) {
				styleHtmlOptions.attr("selected", "selected");
			}
			styleHtmlOptions.appendTo("#styleList");
		}
		$("#styleList option:selected")[0].scrollIntoView();
		$(function() {
			$('#styleList').filterByText($('#citeStyleFilter'), true);
		});
	});
}

// jQuery select filter: http://www.lessanvaezi.com/filter-select-list-options/
// scroll-to and ignore-defocus added by me
jQuery.fn.filterByText = function(textbox, selectSingleMatch) {
	return this.each(function() {
	var select = this;
	var options = [];
	$(select).find('option').each(function() {
		options.push({value: $(this).val(), text: $(this).text()});
	});
	$(select).data('options', options);
	$(textbox).on('change keyup', function() {
		if ($(textbox).data('filtext') == $(textbox).val()) return;
		$(textbox).data('filtext', $(textbox).val());

		var scrollto = false;
		var cursel = null;
		if (select.selectedOptions.length > 0) {
			cursel = select.selectedOptions[0].value;
		}

		var options = $(select).empty().scrollTop(0).data('options');
		var search = $.trim($(this).val());
		// escape special chars
		search = search.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'); 
		// ignore extra spaces and line breaks
		search = search.replace(/\s* /g, '\\s*');
		var regex = new RegExp(search,'gi');
		var option_html = "";
		$.each(options, function(i) {
			var option = options[i];
			if (regex.test(option.text)) {
				option_html += '<option value="' + option.value + '"';
				if (cursel !== null && cursel == option.value) {
					option_html += ' selected="selected"';
					scrollto = true;
				}
				option_html += '>' + option.text + '</option>';
			}
		});
		$(select).html(option_html);
		if (selectSingleMatch === true && $(select).children().length === 1) {
			$(select).children().get(0).selected = true;
		} else if (scrollto === true) {
			select.selectedOptions[0].scrollIntoView();
		}
	});
	});
};

function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

function formSubmitHandler() {
	var doi = encodeURI(trim(document.getElementById("doiInput").value));
	var sel = $("#styleList option:selected").val();
	if (!doi || !checkValidDoi(doi) || typeof sel === 'undefined') {
		return;
	}

	saveSelections();
	getCitation(doi);
}

function saveSelections() {
	var options = {
		cite_style: $("#styleList option:selected").val(),
		cite_locale: $("#citeLocaleInput option:selected").val()
	};

	chrome.storage.local.set(options, null);
}

function checkValidDoi(doiInput) {
	if (/^10\./.test(doiInput)) {
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
	$("#citeOutput").html("");
	$("#citeDiv").css("display", "none");
}

function simpleNotification(message) {
	resetSpace();
	$("#notifyDiv").html(message);
	$("#notifyDiv").css("display", "block");
}

function outputCitation(message) {
	resetSpace();
	$("#citeDiv").html(message);
	$("#citeDiv").css("display", "block");
}

function copyCitation() {
	$("#citeOutput").select();
	document.execCommand('copy');
	$("#citeOutput").select();
}

function getCitation(doi) {
	var style = $("#styleList option:selected").val();
	var locale = $("#citeLocaleInput option:selected").val();

	var resolveUrl = "http://dx.doi.org/" + doi;
	var content = "application/citeproc+json";

	simpleNotification(chrome.i18n.getMessage("loading"));

	chrome.permissions.request({
		origins: [
			'http://*.doi.org/',
			'http://*.crossref.org/',
			'http://*.datacite.org/',
			'https://raw.githubusercontent.com/'
		]
	}, function(granted) {
		if (granted) {
			var jqxhr = $.ajax({
				url: resolveUrl,
				headers: { Accept: content },
				dataType: "text",
				type: "GET",
				cache: false
			});
			jqxhr.done(function() {
				if (jqxhr.responseText !== "" && jqxhr.responseText.charAt(0) != '<') {
					var citation = JSON.parse(jqxhr.responseText);
					initLocales(false, renderBib, citation, style, locale);
				} else {
					simpleNotification(chrome.i18n.getMessage("noCitationFound"));
				}
			});
			jqxhr.fail(function() {
				simpleNotification(chrome.i18n.getMessage("noCitationFound"));
			});
		} else {
			simpleNotification(chrome.i18n.getMessage("needCitationPerm"));
		}
	});
}

function renderBib(citation, style, locale, allLocales) {
	var lang = locale;
	var citations = {
		"Item-1": $.extend({}, { "id": "Item-1" }, citation)
	};

	// origin: raw.githubusercontent.com permission already handled at button press
	var cslUrl = 'https://raw.githubusercontent.com/citation-style-language/styles/master/' + style + '.csl';
	var jqxhrCsl = $.ajax({
		url: cslUrl,
		dataType: "text",
		type: "GET",
		cache: true
	});

	jqxhrCsl.done(function() {
		if (jqxhrCsl.responseText !== "") {
			if (locale === "auto") {
				var xml = jqxhrCsl.responseText,
				  xmlDoc = $.parseXML(xml),
				  $xml = $(xmlDoc),
				  $xmlStyle = $xml.find("style");

				var defaultLocale = $xmlStyle.attr("default-locale");
				if (allLocales.indexOf(defaultLocale) >= 0) {
					lang = defaultLocale;
				} else {
					lang = "en-US";
				}
			}

			var locUrl = 'https://raw.githubusercontent.com/citation-style-language/locales/master/locales-' + lang + '.xml';
			var jqxhrLoc = $.ajax({
				url: locUrl,
				dataType: "text",
				type: "GET",
				cache: true
			});

			jqxhrLoc.done(function() {
				if (jqxhrLoc.responseText !== "") {
					citeprocSys = {
						retrieveLocale: function(lang) {
							return jqxhrLoc.responseText;
						},
						retrieveItem: function(id) {
							return citations[id];
						}
					};

					var styleAsText = jqxhrCsl.responseText;
					var citeproc;
					if (locale === "auto") {
						citeproc = new CSL.Engine(citeprocSys, styleAsText);
					} else {
						citeproc = new CSL.Engine(citeprocSys, styleAsText, lang, 1);
					}

					var itemIDs = [];
					for (var key in citations) {
						if (citations.hasOwnProperty(key)) {
							itemIDs.push(key);
						}
					}
					citeproc.updateItems(itemIDs);

					var bibResult = citeproc.makeBibliography();
					if (typeof bibResult != 'undefined' && bibResult !== false) {
						outputCitation(bibResult[1].join('\n'));
					} else {
						simpleNotification(chrome.i18n.getMessage("citeStyleGenFail"));
					}
				} else {
					simpleNotification(chrome.i18n.getMessage("citeLocaleLoadFailP1") + lang + chrome.i18n.getMessage("citeLocaleLoadFailP2"));
				}
			});
			jqxhrLoc.fail(function() {
				simpleNotification(chrome.i18n.getMessage("citeLocaleLoadFailP1") + lang + chrome.i18n.getMessage("citeLocaleLoadFailP2"));
			});
		} else {
			simpleNotification(chrome.i18n.getMessage("citeStyleLoadFailP1") + style + chrome.i18n.getMessage("citeStyleLoadFailP2"));
		}
	});
	jqxhrCsl.fail(function() {
		simpleNotification(chrome.i18n.getMessage("citeStyleLoadFailP1") + style + chrome.i18n.getMessage("citeStyleLoadFailP2"));
	});
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("citeTitle");
	$("#heading").html(message);
	message = chrome.i18n.getMessage("citeSubHeading");
	$("#subHeading").html(message);
	message = chrome.i18n.getMessage("citeLocale");
	$("#citeLocaleLabel").html(message);
	message = chrome.i18n.getMessage("citeStyleFilterLabel");
	$("#citeStyleFilterLabel").html(message);
}

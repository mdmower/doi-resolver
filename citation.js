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
	var initDOI = getUrlVars()["doi"];
	if(initDOI) {
		$("#doiInput").attr("value", initDOI);
	}

	getLocalMessages()
	buildSelections();
	startListeners();
}, false);

function startListeners() {
	$('#citeForm').submit(function () {
		formSubmitHandler();
		return false;
	});
	$('#copyButton').on("click", copyCitation);
	$(function() {
		$('#styleList').filterByText($('#citeStyleFilter'), true);
	});

	chrome.tabs.getCurrent(function(tab) {
		chrome.runtime.sendMessage({cmd: "record_tab_id", id: tab.id});
	});
}

// Read a page's GET URL variables and return them as an associative array.
// http://jquery-howto.blogspot.com/2009/09/get-url-parameters-values-with-jquery.html
function getUrlVars() {
	var vars = [], hash;
	var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
	for(var i = 0; i < hashes.length; i++) {
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	}
	return vars;
}

function localeCodeToEnglish(loc) {
	var citeproc_js_langs = {"af-ZA":"Afrikaans","ar":"Arabic","bg-BG":"Bulgarian","ca-AD":"Catalan","cs-CZ":"Czech","cy-GB":"Welsh","da-DK":"Danish","de-AT":"German (Austria)","de-CH":"German (Switzerland)","de-DE":"German (Germany)","el-GR":"Greek","en-GB":"English (British)","en-US":"English (US)","es-CL":"Spanish (Chile)","es-ES":"Spanish (Spain)","et-EE":"Estonian","eu":"Basque","fa-IR":"Persian","fi-FI":"Finnish","fr-CA":"French (Canada)","fr-FR":"French (France)","he-IL":"Hebrew","hr-HR":"Croatian","hu-HU":"Hungarian","is-IS":"Icelandic","it-IT":"Italian","ja-JP":"Japanese","km-KH":"Khmer","ko-KR":"Korean","lt-LT":"Lithuanian","lv-LV":"Latvian","mn-MN":"Mongolian","nb-NO":"Norwegian (Bokmål)","nl-NL":"Dutch","nn-NO":"Norwegian (Nynorsk)","pl-PL":"Polish","pt-BR":"Portuguese (Brazil)","pt-PT":"Portuguese (Portugal)","ro-RO":"Romanian","ru-RU":"Russian","sk-SK":"Slovak","sl-SL":"Slovenian","sr-RS":"Serbian","sv-SE":"Swedish","th-TH":"Thai","tr-TR":"Turkish","uk-UA":"Ukrainian","vi-VN":"Vietnamese","zh-CN":"Chinese (PRC)","zh-TW":"Chinese (Taiwan)"};
	return citeproc_js_langs[loc];
}

function getAllLocales() {
	return ["af-ZA","ar","bg-BG","ca-AD","cs-CZ","cy-GB","da-DK","de-AT","de-CH","de-DE","el-GR","en-GB","en-US","es-CL","es-ES","et-EE","eu","fa-IR","fi-FI","fr-CA","fr-FR","he-IL","hr-HR","hu-HU","is-IS","it-IT","ja-JP","km-KH","ko-KR","lt-LT","lv-LV","mn-MN","nb-NO","nl-NL","nn-NO","pl-PL","pt-BR","pt-PT","ro-RO","ru-RU","sk-SK","sl-SL","sr-RS","sv-SE","th-TH","tr-TR","uk-UA","vi-VN","zh-CN","zh-TW"];
}

function buildSelections() {
	// Locales
	var storedLocale = localStorage["cite_locale"];
	var allLocales = getAllLocales();

	if(allLocales.indexOf(storedLocale) < 0) {
		storedLocale = "auto";
		localStorage["cite_locale"] = "auto";
		syncOptions();
	}

	var readableLocales = [];
	for(var i = 0; i < allLocales.length; i++) {
		readableLocales[i] = [allLocales[i], localeCodeToEnglish(allLocales[i])];
	}
	readableLocales.sort( function( a, b ) {
		if(a[1] == b[1]) {
			return 0;
		}
		return a[1] < b[1] ? -1 : 1;
	});

	var localeHtmlOptions = $('<option>').attr("value", "auto").html("Auto");
	if("auto" == storedLocale) {
		localeHtmlOptions.attr("selected", "selected");
	}
	localeHtmlOptions.appendTo("#citeLocaleInput");

	for(var i = 0; i < allLocales.length; i++) {
		localeHtmlOptions = $('<option>').attr("value", readableLocales[i][0]).html(readableLocales[i][1]);
		if(readableLocales[i][0] == storedLocale) {
			localeHtmlOptions.attr("selected", "selected");
		}
		localeHtmlOptions.appendTo("#citeLocaleInput");
	}

	// Migration from short+long styles list to just long list
	if(typeof localStorage["cite_other_style"] != 'undefined') {
		localStorage.removeItem("cite_other_style");
	}

	var storedStyle = localStorage["cite_style"];
	// Style not found or "other" (migration)
	if(allStyleCodes.indexOf(storedStyle) < 0) {
		storedStyle = "bibtex";
		localStorage["cite_style"] = "bibtex";
		syncOptions();
	}

	var styleHtmlOptions;
	for(var i = 0; i < allStyleCodes.length; i++) {
		styleHtmlOptions = $('<option>').attr("value", allStyleCodes[i]);
		styleHtmlOptions.html(allStyleTitles[i]);
		if(allStyleCodes[i] == storedStyle) {
			styleHtmlOptions.attr("selected", "selected");
		}
		styleHtmlOptions.appendTo("#styleList");
	}
	$("#styleList option:selected")[0].scrollIntoView();
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
	$(textbox).bind('change keyup', function() {
		if($(textbox).data('filtext') == $(textbox).val()) return;
		$(textbox).data('filtext', $(textbox).val());

		var scrollto = false;
		var cursel = null;
		if(select.selectedOptions.length > 0)
			cursel = select.selectedOptions[0].value;

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
			if(option.text.match(regex) !== null) {
				option_html += '<option value="' + option.value + '"';
				if(cursel != null && cursel == option.value) {
					option_html += ' selected="selected"';
					scrollto = true;
				}
				option_html += '>' + option.text + '</option>';
			}
		});
		$(select).html(option_html);
		if(selectSingleMatch === true && $(select).children().length === 1) {
			$(select).children().get(0).selected = true;
		} else if(scrollto == true) {
			select.selectedOptions[0].scrollIntoView();
		}
	});
	});
};

function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

function formSubmitHandler() {
	var doi = escape(trim(document.getElementById("doiInput").value));
	var sel = $("#styleList option:selected").val();
	if(!doi || !checkValidDoi(doi) || typeof sel == 'undefined') {
		return;
	}

	saveSelections();
	getCitation(doi);
}

function syncOptions() {
	chrome.runtime.sendMessage({cmd: "sync_opts"});
}

function saveSelections() {
	localStorage["cite_style"] = $("#styleList option:selected").val();
	localStorage["cite_locale"] = $("#citeLocaleInput option:selected").val();
	syncOptions();
}

function checkValidDoi(doiInput) {
	if(doiInput.match(/^10\./)) {
		return true;
	} else if(doiInput.match(/^10\//)) {
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

function htmlEscape(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
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
		if(granted) {
			var jqxhr = $.ajax({
				url: resolveUrl,
				headers: { Accept: content },
				dataType: "text",
				type: "GET",
				cache: false
			});
			jqxhr.done(function() {
				if(jqxhr.responseText != "" && jqxhr.responseText.charAt(0) != '<') {
					var citation = JSON.parse(jqxhr.responseText);
					renderBib(citation, style, locale);
				} else {
					simpleNotification(chrome.i18n.getMessage("noCitationFound"));
				}
			});
			jqxhr.error(function() {
				simpleNotification(chrome.i18n.getMessage("noCitationFound"));
			});
		} else {
			simpleNotification(chrome.i18n.getMessage("needCitationPerm"));
		}
	});
}

function renderBib(citation, style, locale) {
	var allLocales = getAllLocales();
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
		if(jqxhrCsl.responseText != "") {
			if(locale == "auto") {
				var xml = jqxhrCsl.responseText,
				  xmlDoc = $.parseXML(xml),
				  $xml = $(xmlDoc),
				  $xmlStyle = $xml.find("style");

				var defaultLocale = $xmlStyle.attr("default-locale");
				if(allLocales.indexOf(defaultLocale) >= 0) {
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
				if(jqxhrLoc.responseText != "") {
					citeprocSys = {
						retrieveLocale: function(lang) {
							return jqxhrLoc.responseText
						},
						retrieveItem: function(id) {
							return citations[id];
						}
					};

					var styleAsText = jqxhrCsl.responseText;
					var citeproc;
					if(locale == "auto") {
						citeproc = new CSL.Engine(citeprocSys, styleAsText);
					} else {
						citeproc = new CSL.Engine(citeprocSys, styleAsText, lang, 1);
					}

					var itemIDs = [];
					for(var key in citations) {
						itemIDs.push(key);
					}
					citeproc.updateItems(itemIDs);

					var bibResult = citeproc.makeBibliography();
					if(typeof bibResult != 'undefined' && bibResult != false) {
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

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

function buildSelections() {
	// Locales
	var storedLocale = localStorage["cite_locale"];
	var allLocales = ["sk-SK","uk-UA","de-AT","el-GR","th-TH","tr-TR","cs-CZ","hu-HU","sr-RS","fi-FI","ko-KR","lt-LT","vi-VN","bg-BG","en-US","he-IL","et-EE","zh-TW","de-CH","pt-BR","it-IT","sv-SE","is-IS","nb-NO","eu","af-ZA","ja-JP","hr-HR","ar-AR","sl-SI","ca-AD","ro-RO","nn-NO","fa-IR","de-DE","mn-MN","da-DK","es-ES","ru-RU","en-GB","pl-PL","nl-NL","km-KH","fr-FR","zh-CN","fr-CA","pt-PT"];

	if(allLocales.indexOf(storedLocale) < 0) {
		storedLocale = "en-US";
		localStorage["cite_locale"] = "en-US";
		syncOptions();
	}

	var readableLocales = [];
	for(var i = 0; i < allLocales.length; i++) {
		readableLocales[i] = [allLocales[i], localeCodeToEnglish(allLocales[i])];
	}
	readableLocales.sort( function( a, b ) {
		if (a[1] == b[1]) {
			return 0;
		}
		return a[1] < b[1] ? -1 : 1;
	});

	var localeHtmlOptions;
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
jQuery.fn.filterByText = function(textbox, selectSingleMatch) {
	return this.each(function() {
	var select = this;
	var options = [];
	$(select).find('option').each(function() {
		options.push({value: $(this).val(), text: $(this).text()});
	});
	$(select).data('options', options);
	$(textbox).bind('change keyup', function() {
		var options = $(select).empty().scrollTop(0).data('options');
		var search = $.trim($(this).val());
		var regex = new RegExp(search,'gi');
		var option_html = "";
		$.each(options, function(i) {
			var option = options[i];
			if(option.text.match(regex) !== null) {
				option_html += '<option value="' + option.value + '">'
				option_html += option.text + '</option>';
			}
		});
		$(select).html(option_html);
		if (selectSingleMatch === true && $(select).children().length === 1) {
			$(select).children().get(0).selected = true;
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
	$("#citeOutput").html(message);
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
	var content = "text/x-bibliography; style=" + style + "; locale=" + locale;

	simpleNotification(chrome.i18n.getMessage("loading"));

	chrome.permissions.request({
		origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
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
					outputCitation(htmlEscape(jqxhr.responseText));
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

function getLocalMessages() {
	var message = chrome.i18n.getMessage("citeTitle");
	$("#heading").html(message);
	message = chrome.i18n.getMessage("citeLocale");
	$("#citeLocaleLabel").html(message);
	message = chrome.i18n.getMessage("citeStyleFilterLabel");
	$("#citeStyleFilterLabel").html(message);
}

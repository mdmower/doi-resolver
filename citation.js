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
	if(initDOI) document.getElementById("doiInput").setAttribute("value",initDOI);

	getLocalMessages()
	buildSelections();
	startListeners();
}, false);

function startListeners() {
	jQuery('#citeForm').submit(function () {
		formSubmitHandler();
		return false;
	});
	jQuery('#copyButton').click(function() {
		copyCitation()
	});

	document.getElementById('citeStyleInput').addEventListener('change', otherField, false);
}

// Read a page's GET URL variables and return them as an associative array.
// http://jquery-howto.blogspot.com/2009/09/get-url-parameters-values-with-jquery.html
function getUrlVars()
{
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function buildSelections() {
	// LOCALES
	var storedLocale = localStorage["cite_locale"];
	var allLocales = ["sk-SK","uk-UA","de-AT","el-GR","th-TH","tr-TR","cs-CZ","hu-HU","sr-RS","fi-FI","ko-KR","lt-LT","vi-VN","bg-BG","en-US","he-IL","et-EE","zh-TW","de-CH","pt-BR","it-IT","sv-SE","is-IS","nb-NO","eu","af-ZA","ja-JP","hr-HR","ar-AR","sl-SI","ca-AD","ro-RO","nn-NO","fa-IR","de-DE","mn-MN","da-DK","es-ES","ru-RU","en-GB","pl-PL","nl-NL","km-KH","fr-FR","zh-CN","fr-CA","pt-PT"];

	if(allLocales.indexOf(storedLocale) < 0) {
		storedLocale = "en-US";
		localStorage["cite_locale"] = "en-US";
	}

	var readableLocales = [];
	for(var i=0; i < allLocales.length; i++) {
		readableLocales[i] = [allLocales[i], localeCodeToEnglish(allLocales[i])];
	}
	readableLocales.sort( function( a, b ) {
		if ( a[1] == b[1] ) return 0;
		return a[1] < b[1] ? -1 : 1;
	});

	var localeHtmlOptions = "";
	for(var i=0; i < allLocales.length; i++) {
		if(readableLocales[i][0] != storedLocale) {
			localeHtmlOptions += '<option value="' + readableLocales[i][0] + '">' + readableLocales[i][1] + '</option>';
		} else {
			localeHtmlOptions += '<option selected="selected" value="' + readableLocales[i][0] + '">' + readableLocales[i][1] + '</option>';
		}
	}
	document.getElementById('citeLocaleInput').innerHTML = localeHtmlOptions;

	// SHORT STYLES LIST
	var storedStyle = localStorage["cite_style"];
	var baseStyles = ["apa","bibtex","chicago-author-date","ieee","mla","nature","other"];
	var readableStyles = ["APA","BibTeX","Chicago","IEEE","MLA","Nature","Other"];

	if(baseStyles.indexOf(storedStyle) < 0) {
		storedStyle = "bibtex";
		localStorage["cite_style"] = "bibtex";
	}

	var styleHtmlOptions = "";
	for(var i=0; i < baseStyles.length; i++) {
		if(baseStyles[i] != storedStyle) {
			styleHtmlOptions += '<option value="' + baseStyles[i] + '">' + readableStyles[i] + '</option>';
		} else {
			styleHtmlOptions += '<option selected="selected" value="' + baseStyles[i] + '">' + readableStyles[i] + '</option>';
		}
	}
	document.getElementById('citeStyleInput').innerHTML = styleHtmlOptions;

	// FULL STYLES LIST
	var otherStoredStyle = localStorage["cite_other_style"];

	// allStyles is defined when cite_styles.js is called by citation.html
	if(allStyles.indexOf(otherStoredStyle) < 0) {
		otherStoredStyle = "bibtex";
		localStorage["cite_other_style"] = "bibtex";
	}

	var otherStyleHtmlOptions = "";
	for(var i=0; i < allStyles.length; i++) {
		if(allStyles[i] != otherStoredStyle) {
			otherStyleHtmlOptions += '<option value="' + allStyles[i] + '">' + allStyles[i] + '</option>';
		} else {
			otherStyleHtmlOptions += '<option selected="selected" value="' + allStyles[i] + '">' + allStyles[i] + '</option>';
		}
	}
	document.getElementById('styleList').innerHTML = otherStyleHtmlOptions;

	var sideFormElm = document.getElementById('sideForm');
	if(storedStyle == "other") sideFormElm.style.display = "block";
}

function otherField() {
	var elm = document.getElementById('citeStyleInput');
	var style = elm.options[elm.selectedIndex].value;
	var sideFormElm = document.getElementById('sideForm');

	if(style == "other") sideFormElm.style.display = "block";
	else sideFormElm.style.display = "none";
}

function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

function formSubmitHandler() {
	var doi = escape(trim(document.getElementById("doiInput").value));
	if(!doi || !checkValidDoi(doi)) return;

	saveSelections();
	getCitation(doi);
}

function saveSelections() {
	var citeStyle = document.getElementById("citeStyleInput");
	localStorage["cite_style"] = citeStyle.options[citeStyle.selectedIndex].value;
	var citeLocale = document.getElementById("citeLocaleInput");
	localStorage["cite_locale"] = citeLocale.options[citeLocale.selectedIndex].value;
	var otherStyleElm = document.getElementById("styleList");
	localStorage["cite_other_style"] = otherStyleElm.options[otherStyleElm.selectedIndex].value;
}

function checkValidDoi(doiInput) {
	if(doiInput.match(/^10\./)) {
		return true;
	} else if(doiInput.match(/^10\//)) {
		return true;
	} else {
		notification(chrome.i18n.getMessage("invalidDoiAlert"));
		return false;
	}
}

function resetSpace() {
	var notifyElm = document.getElementById("notifyDiv");
	var citeElm = document.getElementById("citeDiv");
	var citeOutElm = document.getElementById("citeOutput");

	notifyElm.innerHTML = "";
	citeOutElm.innerHTML = "";

	notifyElm.style.display = "none";
	citeElm.style.display = "none";
}

function notification(message) {
	resetSpace();

	var notifyElm = document.getElementById("notifyDiv");
	notifyElm.style.display = "block";
	notifyElm.innerHTML = message;
}

function outputCitation(message) {
	resetSpace();

	var citeElm = document.getElementById("citeDiv");
	var citeOutElm = document.getElementById("citeOutput");

	citeElm.style.display = "block";
	citeOutElm.innerHTML = message;
}

function copyCitation() {
	jQuery("#citeOutput").select();
    document.execCommand('copy');
	jQuery("#citeOutput").select();
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
	var styleElm = document.getElementById("citeStyleInput");
	var style = styleElm.options[styleElm.selectedIndex].value;
	var localeElm = document.getElementById("citeLocaleInput");
	var locale = localeElm.options[localeElm.selectedIndex].value;

	if(style == "other") {
		var otherStyleElm = document.getElementById("styleList");
		style = otherStyleElm.options[otherStyleElm.selectedIndex].value;
	}

	var resolveUrl = "http://dx.doi.org/" + doi;
	var content = "text/x-bibliography; style=" + style + "; locale=" + locale;

	notification(chrome.i18n.getMessage("loading"));

	chrome.permissions.request({
		origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
	}, function(granted) {
		if(granted) {
			var jqxhr = jQuery.ajax({
				url: resolveUrl,
				headers: { Accept: content },
				dataType: "text",
				type: "GET",
				cache: false
			});
			jqxhr.done(function() {
				if(jqxhr.responseText != "") outputCitation(htmlEscape(jqxhr.responseText));
				else notification(chrome.i18n.getMessage("noCitationFound"));
			});
			jqxhr.error(function() {
				notification(chrome.i18n.getMessage("noCitationFound"));
			});
		} else {
			notification(chrome.i18n.getMessage("needCitationPerm"));
		}
	});
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("citeTitle");
	document.getElementById("heading").innerHTML = message;
	message = chrome.i18n.getMessage("citeStyle");
	document.getElementById("citeStyleLabel").innerHTML = message;
	message = chrome.i18n.getMessage("citeLocale");
	document.getElementById("citeLocaleLabel").innerHTML = message;
}

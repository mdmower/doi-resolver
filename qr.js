document.addEventListener('DOMContentLoaded', function () {
	getLocalMessages();
	getUrlVariables();
	restoreQrTitleState();
	startListeners();
}, false);

function startListeners() {
	$("#doiForm").submit(function () {
		formSubmitHandler();
		return false;
	});

	$("#qrTitle").on("click", setCrossrefPermission);
}

// Read a page's GET URL variables and return them as an associative array.
// http://jquery-howto.blogspot.com/2009/09/get-url-parameters-values-with-jquery.html
function getUrlVariables() {
	var vars = [], hash;
	var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++) {
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	}

	var initDOI = vars["doi"];
	if(initDOI) {
		$("#doiInput").val(initDOI);
	}
}

function restoreQrTitleState() {
	if(localStorage["qr_title"] == "true") {
		$("#qrTitle").prop("checked", true);
	}
}

function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
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
	$("#notifyDiv").css({"display": "none", "width": "384px"});
	$("#qrDiv").html("");
	$("#qrDiv").css("display", "none");
}

function simpleNotification(message) {
	resetSpace();
	$("#notifyDiv").html(message);
	$("#notifyDiv").css("display", "block");
}

function notification(elms, size) {
	resetSpace();
	for(var i = 0; i < elms.length; i++) {
		elms[i].appendTo($("#notifyDiv"));
	}
	$("#notifyDiv").css("width", size);
	$("#notifyDiv").css("display", "block");
}

function setCrossrefPermission() {
	var perm = $("#qrTitle").is(":checked");

	if(perm) {
		chrome.permissions.request({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(granted) {
			if(granted) {
				localStorage["qr_title"] = true;
				$("#qrTitle").prop("checked", true);
			} else {
				localStorage["qr_title"] = false;
				$("#qrTitle").prop("checked", false);
			}
		});
	} else {
		chrome.permissions.remove({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(removed) {
			if(removed) {
				localStorage["qr_title"] = false;
				$("#qrTitle").prop("checked", false);
			} else {
				localStorage["qr_title"] = true;
				$("#qrTitle").prop("checked", true);
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
	var actionType = $('input[name="imageType"]:checked').val();
	var doiInput = escape(trim($("#doiInput").val()));
	var size = parseInt(escape($("#sizeInput").val()));

	if(!doiInput || !size || !checkValidDoi(doiInput)) return;
	if(size < 80) {
		simpleNotification(chrome.i18n.getMessage("invalidQrSizeAlert"));
		return;
	}

	switch(actionType) {
	case 'submit':
	case 'png':
		insertQr(doiInput,size,'png');
		break;
	case 'jpg':
		insertQr(doiInput,size,'jpg');
		break;
	default:
		break;
	}
}

function insertQr(doiInput,size,outputType) {
	resetSpace();

	var stringToEncode = "";
	var jsonUrl = "http://dx.doi.org/" + doiInput;

	if(doiInput.match(/^10\./)) {
		stringToEncode = "http://dx.doi.org/" + doiInput;
	} else if(doiInput.match(/^10\//)) {
		stringToEncode = "http://doi.org/" + doiInput.replace(/^10\//,"");
	}

	simpleNotification("Loading...");

	if(localStorage["qr_title"] == "true") {
		chrome.permissions.request({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(granted) {
			if(granted) {
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
						$("#qrDiv").qrcode({width: size, height: size, text: stringToEncode});
						outputImg(size, outputType, stringToEncode, "found");
					} catch(e) {
						$("#qrDiv").qrcode({width: size, height: size, text: stringToEncode});
						outputImg(size, outputType, stringToEncode, "missing");
					}
				});
				jqxhr.error(function() {
					$("#qrDiv").qrcode({width: size, height: size, text: stringToEncode});
					outputImg(size, outputType, stringToEncode, "missing");
				});
			} else {
				$("#qrDiv").qrcode({width: size, height: size, text: stringToEncode});
				outputImg(size, outputType, stringToEncode, "disabled");
			}
		});
	} else {
		$("#qrDiv").qrcode({width: size, height: size, text: stringToEncode});
		outputImg(size, outputType, stringToEncode, "disabled");
	}
}

function outputImg(size, outputType, stringToEncode, titleRetrieval) {
	var canvas = document.getElementById("qrDiv").firstChild;
	var sizeString = (size + "px").toString();
	var titleNotice = "";
	var statusMessage = "";

	switch(titleRetrieval) {
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

	if(canvas) {
		var img = $('<img>');
		img.attr("width", sizeString);
		img.attr("height", sizeString);
		img.attr("alt", "QR Code");
		img.attr("id", "qrImage");
		if(outputType == "png") {
			img.attr("src", canvas.toDataURL("image/png"));
		} else if(outputType == "jpg")	{
			img.attr("src", canvas.toDataURL("image/jpeg"));
		}

		var saveLink = $('<a>').attr("id", "qrImageSaveLink");
		if(outputType == "png")	{
			saveLink.attr("href", canvas.toDataURL("image/png"));
			saveLink.attr("download", "qrImage.png");
		} else if(outputType == "jpg")	{
			saveLink.attr("href", canvas.toDataURL("image/jpeg"));
			saveLink.attr("download", "qrImage.jpg");
		}

		var statusMessage = [];
		var tmp = $('<span>').attr("class", "heading");
		tmp.html(chrome.i18n.getMessage("qrTitleStatus"));
		statusMessage.push(tmp);
		tmp = $('<span>').html(titleNotice);
		statusMessage.push(tmp);
		tmp = $('<br>');
		statusMessage.push(tmp);
		tmp = $('<span>').attr("class", "heading");
		tmp.html(chrome.i18n.getMessage("qrMessageEncoded"));
		statusMessage.push(tmp);
		tmp = $('<span>').html(htmlEscape(stringToEncode));
		statusMessage.push(tmp);
		tmp = $('<br>');
		statusMessage.push(tmp);
		tmp = $('<span>').attr("class", "highlight");
		tmp.html("&nbsp;" + chrome.i18n.getMessage("qrSave") + "&nbsp;");
		statusMessage.push(tmp);

		notification(statusMessage, "790px");

		img.appendTo($("#qrDiv"));
		$("#qrImage").wrap(saveLink);
		$("#qrDiv").css({"display": "block", "height": (size + "px"), "line-height": (size + "px")});
	}
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("qrSize");
	$("#sizeInputLabel").html(message);
	message = chrome.i18n.getMessage("qrTitleLabel");
	$("#qrTitleLabel").html(message);
}

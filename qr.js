document.addEventListener('DOMContentLoaded', function () {
	getLocalMessages();
	getUrlVariables();	
	restoreQrTitleState();
	startListeners();
}, false);

function startListeners() {
	jQuery('#doiForm').submit(function () {
		formSubmitHandler();
		return false;
	});
	
	document.getElementById("qrTitle").addEventListener("click", setCrossrefPermission, false);
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
	if(initDOI) document.getElementById("doiInput").value = initDOI;
}

function restoreQrTitleState() {
	if(localStorage["qr_title"] == "true") document.getElementById("qrTitle").checked = true;
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
		notification(chrome.i18n.getMessage("invalidDoiAlert"));
		return false;
	}
}

function resetSpace() {
	var notifyElm = document.getElementById("notifyDiv");
	var qrElm = document.getElementById("qrDiv");
	
	notifyElm.innerHTML = "";
	qrElm.innerHTML = "";
	
	notifyElm.style.display = "none";
	notifyElm.style.width = "384px";
	qrElm.style.display = "none";
}

function notification(message) {
	resetSpace();
	
	var notifyElm = document.getElementById("notifyDiv");
	notifyElm.innerHTML = message;
	notifyElm.style.display = "block";
}

function setCrossrefPermission() {
	var perm = document.getElementById("qrTitle").checked;
	
	if(perm) {
		chrome.permissions.request({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(granted) {
			if(granted) {
				localStorage["qr_title"] = true;
				document.getElementById("qrTitle").checked = true;
			} else {
				localStorage["qr_title"] = false;
				document.getElementById("qrTitle").checked = false;
			}
		});
	} else {
		chrome.permissions.remove({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(removed) {
			if(removed) {
				localStorage["qr_title"] = false;
				document.getElementById("qrTitle").checked = false;
			} else {
				localStorage["qr_title"] = true;
				document.getElementById("qrTitle").checked = true;
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
	var actionType = jQuery('input[name=imageType]:checked').val();
	var doiInput = escape(trim(jQuery('#doiInput').val()));
	var size = parseInt(escape(jQuery('#sizeInput').val()));
	
	if(!doiInput || !size || !checkValidDoi(doiInput)) return;
	if(size < 80) {
		notification(chrome.i18n.getMessage("invalidQrSizeAlert"));
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
		
	if(doiInput.match(/^10\./)) stringToEncode = "http://dx.doi.org/" + doiInput;
	else if(doiInput.match(/^10\//)) stringToEncode = "http://doi.org/" + doiInput.replace(/^10\//,"");
	
	notification("Loading...");
	
	if(localStorage["qr_title"] == "true") {
		chrome.permissions.request({
			origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
		}, function(granted) {
			if(granted) {
				var jqxhr = jQuery.ajax({
					url: jsonUrl,
					headers: { Accept: "application/citeproc+json" },
					dataType: "text",
					type: "GET",
					cache: false
				});
				jqxhr.done(function() {
					var doiTitle = JSON.parse(jqxhr.responseText).title;
					doiTitle = doiTitle.replace(/<subtitle>(.*)<\/subtitle>/," - $1");
					doiTitle = doiTitle.replace(/<alt-title>(.*)<\/alt-title>/,"");
					doiTitle = doiTitle.replace(/<.*>(.*)<\/.*>/,"$1");
					stringToEncode = doiTitle + "\n" + stringToEncode;
					jQuery('#qrDiv').qrcode({width:size, height:size, text:stringToEncode});
					outputImg(size,outputType,stringToEncode,"found");
				});
				jqxhr.error(function() {
					jQuery('#qrDiv').qrcode({width:size, height:size, text:stringToEncode});
					outputImg(size,outputType,stringToEncode,"missing");
				});
			} else {
				jQuery('#qrDiv').qrcode({width:size, height:size, text:stringToEncode});
				outputImg(size,outputType,stringToEncode,"disabled");
			}
		});
	} else {
		jQuery('#qrDiv').qrcode({width:size, height:size, text:stringToEncode});
		outputImg(size,outputType,stringToEncode,"disabled");
	}
}

function outputImg(size,outputType,stringToEncode,titleRetrieval) {
	var qrElm = document.getElementById("qrDiv");
	var notifyElm = document.getElementById("notifyDiv");
	var canvas = qrElm.firstChild;
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
		var img = document.createElement('img');
		img.setAttribute('width', sizeString);
		img.setAttribute('height', sizeString);
		img.setAttribute('alt', 'QR Code');
		img.setAttribute('id', 'qrImage');
		if(outputType == 'png')	img.setAttribute('src', canvas.toDataURL("image/png"));
		if(outputType == 'jpg')	img.setAttribute('src', canvas.toDataURL("image/jpeg"));
		
		var saveLink = document.createElement('a');
		saveLink.setAttribute('id', 'qrImageSaveLink');
		if(outputType == 'png')	{
			saveLink.setAttribute('href', canvas.toDataURL("image/png"));
			saveLink.setAttribute('download', 'qrImage.png');
		}
		if(outputType == 'jpg')	{
			saveLink.setAttribute('href', canvas.toDataURL("image/jpeg"));
			saveLink.setAttribute('download', 'qrImage.jpg');
		}
		
		statusMessage = "<span class=\"heading\">"
			+chrome.i18n.getMessage("qrTitleStatus")
			+"</span>"
			+titleNotice
			+"<br><span class=\"heading\">"
			+chrome.i18n.getMessage("qrMessageEncoded")
			+"</span>"
			+htmlEscape(stringToEncode)
			+"<br><span class=\"highlight\">\&nbsp;"
			+chrome.i18n.getMessage("qrSave")
			+"\&nbsp;</span>";
		
		notification(statusMessage);
		notifyElm.style.width = "790px";
		
		qrElm.appendChild(img);
		jQuery('#qrImage').wrap(saveLink);
		qrElm.style.display = "block";
		qrElm.style.height = (size + "px").toString();
		qrElm.style.lineHeight = (size + "px").toString();
	}
}

function saveImage(imageType) {
	var imgSrc = document.getElementById("qrImage").getAttribute("src");
	var dataUrl = imgSrc;
	// var dataUrl = imgSrc.replace("image/png", "image/octet-stream");
	download(dataUrl,"QR-Code.png");
}

function download(url, filename) {
	var link = document.createElement('a');
	link.setAttribute('href',url);
	link.setAttribute('download',filename);
	var event = document.createEvent('Event');
	event.initEvent("click", true, true);
	link.dispatchEvent(event);
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("qrSize");
	document.getElementById("sizeInputLabel").innerHTML = message;
	message = chrome.i18n.getMessage("qrTitleLabel");
	document.getElementById("qrTitleLabel").innerHTML = message;
}

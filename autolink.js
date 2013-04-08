// http://stackoverflow.com/questions/27910/finding-a-doi-in-a-document-or-page
var find = /\b(10[.][0-9]{3,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)\b/ig;
replaceDOIsWithLinks();

// http://stackoverflow.com/questions/1444409/in-javascript-how-can-i-replace-text-in-an-html-page-without-affecting-the-tags
function replaceDOIsWithLinks() {
	replaceInElement(document.body, find, function(match) {
		var link = document.createElement('a');
		chrome.extension.sendMessage({cmd: "resolve_url"}, function(response) {
			link.href = response.cmd + match[0];
		});
		link.appendChild(document.createTextNode(match[0]));
		return link;
	});
	
}

function replaceInElement(element, find, replace) {
    // iterate over child nodes in reverse, as replacement may increase length of child node list.
    for (var i = element.childNodes.length; i-->0;) {
        var child = element.childNodes[i];
        if (child.nodeType==1) { // ELEMENT_NODE
            var tag = child.nodeName.toLowerCase();
            if (tag!='style' && tag!='script' && tag!='a' && tag!='input' && tag!='textarea') // don't touch these elements
                replaceInElement(child, find, replace);
        } else if (child.nodeType==3) { // TEXT_NODE
            replaceInText(child, find, replace);
        }
    }
}
function replaceInText(text, find, replace) {
    var match;
    var matches = [];
    while (match = find.exec(text.data))
        matches.push(match);
    for (var i= matches.length; i-->0;) {
        match= matches[i];
        text.splitText(match.index);
        text.nextSibling.splitText(match[0].length);
        text.parentNode.replaceChild(replace(match), text.nextSibling);
    }
}

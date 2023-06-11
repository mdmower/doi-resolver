/**
 * @license Apache-2.0
 */

import {logError, logWarn} from '../logger';
import {
  AutolinkVarsMessage,
  MessageCmd,
  isAutolinkVarsMessage,
  sendInternalMessageAsync,
} from '../messaging';

const definitions = {
  // https://stackoverflow.com/questions/27910/finding-a-doi-in-a-document-or-page
  findDoi: /\b(10\.[0-9]{4,}(?:\.[0-9]+)*\/(?:(?!["&'<>])\S)+)\b/gi,
  findUrl: /^(?:https?:\/\/)(?:dx\.)?doi\.org\/(10\.[0-9]{4,}(?:\.[0-9]+)*\/(?:(?!["&'<>])\S)+)$/i,
  rewriteAnchorHref: false,
  doiResolver: '',
};

// Do not attempt text --> anchor replacement within these elements
const forbiddenTags = ['A', 'BUTTON', 'INPUT', 'SCRIPT', 'SELECT', 'STYLE', 'TEXTAREA'];

/**
 * Send an internal message to request autolink option values from storage
 */
async function setDefinitions(): Promise<void> {
  const response = await sendInternalMessageAsync<AutolinkVarsMessage, AutolinkVarsMessage>({
    cmd: MessageCmd.AutolinkVars,
  });

  if (!isAutolinkVarsMessage(response) || !response.data) {
    throw new Error('Invalid autolink message response');
  }

  definitions.rewriteAnchorHref = response.data.rewriteAnchorHref;
  definitions.doiResolver = response.data.doiResolver;
}

/**
 * Determine whether a child node is an anchor element
 * @param node HTML child node
 */
function isAnchorElement(node: ChildNode): node is HTMLAnchorElement {
  return node.nodeName === 'A';
}

/**
 * Determine whether a child node is a text node
 * @param node HTML child node
 */
function isTextNode(node: ChildNode): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

/**
 * Search document for text DOIs and linked DOIs. Depending on options,
 * replace them with custom resolver linked DOIs.
 *
 * https://stackoverflow.com/questions/1444409/in-javascript-how-can-i-replace-text-in-an-html-page-without-affecting-the-tags
 */
function replaceDOIsWithLinks() {
  try {
    replaceInElement(document.body, definitions.findDoi, (match) => {
      const link = document.createElement('a');
      link.href = definitions.doiResolver + match[0];
      link.appendChild(document.createTextNode(match[0]));
      return link;
    });
  } catch (ex) {
    logError('DOI autolink encountered an exception', ex);
  }
}

/**
 * Recursively search element for DOI text and links and replace them as
 * they are identified.
 * @param node HTML child node
 * @param findDoi Regex for DOI matching
 * @param replaceText Method to replace matched DOI text with anchor
 */
function replaceInElement(
  node: ChildNode,
  findDoi: RegExp,
  replaceText: (match: RegExpExecArray) => HTMLAnchorElement
) {
  // iterate over child nodes in reverse, as replacement may increase length of child node list.
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const child = node.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      if (!forbiddenTags.includes(child.nodeName)) {
        replaceInElement(child, findDoi, replaceText);
      } else if (definitions.rewriteAnchorHref && isAnchorElement(child)) {
        const urlMatch = definitions.findUrl.exec(child.href);
        if (urlMatch) {
          child.href = definitions.doiResolver + urlMatch[1];
        }
      }
    } else if (isTextNode(child)) {
      replaceInText(child, findDoi, replaceText);
    }
  }
}

/**
 * Split a text node into text + anchor + text as many times as necessary
 * to replace all text DOIs with linked DOIs.
 * @param text Text node
 * @param findDoi Regex for DOI matching
 * @param replaceText Method to replace matched DOI text with anchor
 */
function replaceInText(
  text: Text,
  findDoi: RegExp,
  replaceText: (match: RegExpExecArray) => HTMLAnchorElement
) {
  const parentNode = text.parentNode;
  if (!parentNode) {
    return;
  }

  const matches: RegExpExecArray[] = [];
  let match = findDoi.exec(text.data);
  while (match !== null) {
    matches.push(match);
    match = findDoi.exec(text.data);
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    match = matches[i];
    const remainder = text.splitText(match.index);
    remainder.splitText(match[0].length);
    parentNode.replaceChild(replaceText(match), remainder);
  }
}

(async function () {
  await setDefinitions();
  if (definitions.doiResolver) {
    replaceDOIsWithLinks();
  } else {
    logWarn('DOI autolink disabled because DOI resolver unset');
  }
})().catch((error) => {
  logError('DOI autolink could not run', error);
});

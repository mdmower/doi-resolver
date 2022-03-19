/**
 * @license Apache-2.0
 */

import {ContextMenuToggleMessage, MessageCmd, sendInternalMessage} from './messaging';
import {debounce} from './utils';

(function () {
  // https://stackoverflow.com/questions/27910/finding-a-doi-in-a-document-or-page
  const doiRegex = /\b(10\.[0-9]{4,}(?:\.[0-9]+)*\/(?:(?!["&'<>])\S)+)\b/i;

  const selectHandler = debounce(() => {
    const selection = document.getSelection()?.toString() || '';
    const doiMatch = doiRegex.exec(selection);
    sendInternalMessage<ContextMenuToggleMessage, undefined>({
      cmd: MessageCmd.ContextMenuToggle,
      data: {
        enable: !!doiMatch,
        doi: doiMatch ? doiMatch[1] : '',
      },
    });
  }, 50);

  try {
    document.addEventListener('selectionchange', selectHandler);
    // Handle scenario: doi is selected in a window, enabling context menu,
    // then window loses focus and selection in another window disables
    // context menu, and finally original window focused with original DOI
    // text selection still in place.
    window.addEventListener('focus', selectHandler);
  } catch (ex) {
    console.log('DOI context menu selection detection encountered an exception', ex);
  }
})();

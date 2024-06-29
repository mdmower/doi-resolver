/**
 * @license Apache-2.0
 */

import {logInfo} from './lib/logger';
import {ContextMenuToggleMessage, MessageCmd, sendInternalMessage} from './lib/messaging';
import {debounce, findDoiInString} from './lib/utils';

(function () {
  const selectHandler = debounce(() => {
    const selection = document.getSelection()?.toString() || '';
    const doi = findDoiInString(selection);
    sendInternalMessage<ContextMenuToggleMessage>({
      cmd: MessageCmd.ContextMenuToggle,
      data: {
        enable: !!doi,
        doi,
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
    logInfo('DOI context menu selection detection encountered an exception', ex);
  }
})();

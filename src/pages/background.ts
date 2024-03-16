/**
 * @license Apache-2.0
 */

import {autolinkHandler} from '../autolink';
import {addContextMenu, resetContextMenu} from '../background';
import {contextMenuHandler, contextMenuMatchHandler} from '../context_menu';
import {logError, logInfo} from '../logger';
import {runtimeMessageHandler} from '../messaging';
import {omniHandler} from '../omnibox';
import {
  checkForNewOptions,
  removeDeprecatedOptions,
  storageChangeHandler,
  verifySyncState,
} from '../storage';

chrome.runtime.onInstalled.addListener(install);
chrome.storage.onChanged.addListener(storageChangeHandler);
chrome.omnibox.onInputEntered.addListener(omniHandler);
chrome.tabs.onUpdated.addListener(autolinkHandler);
chrome.tabs.onUpdated.addListener(contextMenuMatchHandler);
chrome.runtime.onMessage.addListener(runtimeMessageHandler);
chrome.contextMenus.onClicked.addListener(contextMenuHandler);

/**
 * Handle extension install event
 */
function install() {
  addContextMenu();
  removeDeprecatedOptions()
    .then(verifySyncState)
    .then(checkForNewOptions)
    .then(resetContextMenu)
    .then(() => logInfo('Extension install completed'))
    .catch((error) => {
      logError('Error encountered during extension install\n', error);
    });
}

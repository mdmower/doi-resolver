/**
 * @license Apache-2.0
 */

import {autolinkHandler} from './autolink';
import {addContextMenu, resetContextMenu} from './background';
import {contextMenuHandler, contextMenuMatchHandler} from './context_menu';
import {logError, logInfo} from './logger';
import {runtimeMessageHandler} from './messaging';
import {omniHandler} from './omnibox';
import {
  checkForNewOptions,
  removeDeprecatedOptions,
  storageChangeHandler,
  verifySyncState,
} from './storage';

self.addEventListener('install', install);
self.addEventListener('activate', activate);

chrome.storage.onChanged.addListener(storageChangeHandler);
chrome.omnibox.onInputEntered.addListener(omniHandler);
chrome.tabs.onUpdated.addListener(autolinkHandler);
chrome.tabs.onUpdated.addListener(contextMenuMatchHandler);
chrome.runtime.onMessage.addListener(runtimeMessageHandler);
chrome.contextMenus.onClicked.addListener(contextMenuHandler);

/**
 * Handle service worker install event
 */
function install() {
  addContextMenu();
  logInfo('Service worker installed');
}

/**
 * Handle service worker activate event
 */
function activate() {
  removeDeprecatedOptions()
    .then(verifySyncState)
    .then(checkForNewOptions)
    .then(resetContextMenu)
    .then(() => logInfo('Service worker activated'))
    .catch((error) => {
      logError('Error encountered during service worker activation\n', error);
    });
}

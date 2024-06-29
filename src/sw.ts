/**
 * @license Apache-2.0
 */

import {autolinkHandler} from './lib/autolink';
import {addContextMenu, resetContextMenu} from './lib/background';
import {contextMenuHandler, contextMenuMatchHandler} from './lib/context_menu';
import {logError, logInfo} from './lib/logger';
import {runtimeMessageHandler} from './lib/messaging';
import {omniHandler} from './lib/omnibox';
import {
  checkForNewOptions,
  removeDeprecatedOptions,
  storageChangeHandler,
  verifySyncState,
} from './lib/storage';

// Reference: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
// TODO: W3C is discussing new listeners (names subject to change): onEnabled, onExtensionLoaded
// https://github.com/w3c/webextensions/issues/353
chrome.runtime.onInstalled.addListener(install);
chrome.runtime.onStartup.addListener(startup);

chrome.storage.onChanged.addListener(storageChangeHandler);
chrome.omnibox.onInputEntered.addListener(omniHandler);
chrome.tabs.onUpdated.addListener(autolinkHandler);
chrome.tabs.onUpdated.addListener(contextMenuMatchHandler);
chrome.runtime.onMessage.addListener(runtimeMessageHandler);
chrome.contextMenus.onClicked.addListener(contextMenuHandler);

/**
 * Handle extension install event
 * @param details Extension install information
 */
function install(details: chrome.runtime.InstalledDetails) {
  // Only need to create context menu when extension is installed or updated,
  // not when the browser is updated.
  if (details.reason !== 'install' && details.reason !== 'update') {
    return;
  }

  addContextMenu();
  startup();
  logInfo('Extension installed');
}

/**
 * Handle browser profile startup event
 */
function startup() {
  removeDeprecatedOptions()
    .then(verifySyncState)
    .then(checkForNewOptions)
    .then(resetContextMenu)
    .then(() => logInfo('Startup event handled'))
    .catch((error) => {
      logError('Error encountered while processing startup handler\n', error);
    });
}

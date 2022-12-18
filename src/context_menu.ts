/**
 * @license Apache-2.0
 */

import {checkContentScriptPermissions} from './permissions';
import {resolveDoi} from './resolve';
import {getOptions, setOptions} from './options';
import {showNotification} from './notification';
import {logError, logInfo, logWarn} from './logger';
import {queueRecordDoi} from './history';
import {findDoiInString} from './utils';

export enum ContextMenuId {
  ResolveDoi = 'resolve_doi',
}

/**
 * Create the context menu feature
 * @param id Context menu ID
 */
export function createContextMenu(id: ContextMenuId): void {
  if (id !== ContextMenuId.ResolveDoi) {
    // TODO: Support multiple context menu items
    return;
  }

  chrome.contextMenus.create({
    id,
    title: chrome.i18n.getMessage('contextText'),
    type: 'normal',
    contexts: ['selection'],
    visible: false,
  });
}

/**
 * Show/hide the context menu feature
 * @param id Context menu ID
 * @param visible Whether the context menu item should be visible
 * @param doi DOI if available
 */
export function updateContextMenu(id: ContextMenuId, visible: boolean, doi?: string): void {
  if (id !== ContextMenuId.ResolveDoi) {
    // TODO: Support multiple context menu items
    return;
  }

  const resolveDoiText = chrome.i18n.getMessage('contextText');
  chrome.contextMenus.update(id, {
    title: doi ? `${resolveDoiText} "${doi}"` : resolveDoiText,
    visible,
  });
}

/**
 * Handle the context menu feature click
 * @param info OnClick event data
 */
export function contextMenuHandler(info: chrome.contextMenus.OnClickData): void {
  contextMenuHandlerAsync(info).catch((error) => {
    logError('Failed to handle context menu click', error);
  });
}

/**
 * Async handling for the context menu feature click
 * @param info OnClick event data
 */
async function contextMenuHandlerAsync(info: chrome.contextMenus.OnClickData): Promise<void> {
  if (info.menuItemId !== ContextMenuId.ResolveDoi) {
    // TODO: Support multiple context menu items
    return;
  }

  const doi = findDoiInString(info.selectionText || '');
  if (!doi) {
    const notificationTitle = 'Invalid DOI';
    const notificationMessage = chrome.i18n.getMessage('invalidDoiAlert');
    showNotification(notificationTitle, notificationMessage);
    return;
  }

  // This action doesn't qualify as a user gesture, so we can't request meta
  // permissions (i.e. re-establish them for free if they were removed). If
  // the permissions happen to be available, they will be used automatically
  // by during history update.
  await queueRecordDoi(doi);

  const stg = await getOptions('local', ['custom_resolver', 'cr_context']);
  const cr = stg.custom_resolver;
  const crc = stg.cr_context;
  await resolveDoi(doi, cr === true && crc === 'custom', 'newForegroundTab');
}

/**
 * Handle tab update reports for context menu match content script
 * @param tabId Tab ID
 * @param changeInfo Tab change info
 * @param tab Tab data
 */
export function contextMenuMatchHandler(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): void {
  contextMenuMatchHandlerAsync(tabId, changeInfo, tab).catch((error) => {
    logError('Failed to run context menu match handler', error);
  });
}

/**
 * Handle tab update reports for context menu match content script
 * @param tabId Tab ID
 * @param changeInfo Tab change info
 * @param tab Tab data
 */
async function contextMenuMatchHandlerAsync(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (changeInfo.status !== 'complete') {
    return;
  }

  const stg = await getOptions('local', ['context_menu_match']);
  if (!stg.context_menu_match) {
    return;
  }

  const permissionResult = await checkContentScriptPermissions();
  if (!permissionResult) {
    await setOptions('local', {context_menu_match: false});
    logWarn(
      'Context menu match handling is enabled but has insufficient content script permissions, disabling.'
    );
    return;
  }

  // tab.url requires optional tabs permission, so this needs to come after the check for
  // content script permissions.
  if (
    !/^https?:\/\//i.test(tab.url || '') ||
    /^https:?\/\/chrome\.google\.com\/webstore[/$]/i.test(tab.url || '')
  ) {
    return;
  }

  // Apply context menu match content script
  const injectionResults = await chrome.scripting.executeScript({
    target: {tabId: tabId, allFrames: true},
    files: ['context_match.js'],
  });

  if (chrome.runtime.lastError || injectionResults === undefined) {
    logInfo(`Context menu match listener failed to run on ${tab.url || ''}`);
  }
}

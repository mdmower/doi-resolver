/**
 * @license Apache-2.0
 */

import {logError, logInfo, logWarn} from './logger';
import {AutolinkVarsMessage, MessageCmd} from './messaging';
import {getDefaultOptions, getOptions, setOptions} from './options';
import {checkContentScriptPermissions} from './permissions';

/**
 * Send autolink option values via internal messaging
 * @param sendResponse Messaging method
 */
export async function sendAutolinkOptions(
  sendResponse: (response: AutolinkVarsMessage) => void
): Promise<void> {
  const stg = await getOptions('local', [
    'cr_autolink',
    'auto_link_rewrite',
    'custom_resolver',
    'doi_resolver',
  ]);

  let doiResolver: string;
  if (stg.custom_resolver && stg.cr_autolink == 'custom' && stg.doi_resolver) {
    doiResolver = stg.doi_resolver;
  } else {
    doiResolver = getDefaultOptions()['doi_resolver'];
  }
  const rewriteAnchorHref = !!stg.auto_link_rewrite;

  sendResponse({
    cmd: MessageCmd.AutolinkVars,
    data: {doiResolver, rewriteAnchorHref},
  });
}

/**
 * Test whether a URL should be excluded from DOI autolinking
 * @param url URL
 * @param autolinkExclusions Exclusion URLs and URL patterns
 * (will be retrieved from storage if undefined)
 */
export async function testAutolinkExclusion(
  url: string,
  autolinkExclusions?: string[]
): Promise<boolean> {
  const testExclusion = (exclusions: string[]): boolean => {
    if (!/^https?:\/\//i.test(url) || /^https:?\/\/chrome\.google\.com\/webstore[/$]/i.test(url)) {
      return true;
    }

    const urlNoProtocol = url.replace(/^https?:\/\//i, '').toLowerCase();
    return exclusions.some((exclusion) => {
      if (exclusion.charAt(0) === '/' && exclusion.slice(-1) === '/') {
        try {
          const re = new RegExp(exclusion.slice(1, -1), 'i');
          return re.test(urlNoProtocol);
        } catch (ex) {
          logWarn('Invalid regular expression', exclusion, ex);
        }
      } else if (urlNoProtocol.startsWith(exclusion.toLowerCase())) {
        return true;
      }
      return false;
    });
  };

  if (autolinkExclusions === undefined) {
    const stg = await getOptions('local', ['autolink_exclusions']);
    autolinkExclusions = stg['autolink_exclusions'] || [];
  }

  return testExclusion(autolinkExclusions);
}

/**
 * Handle tab update reports for autolink content script
 * @param tabId Tab ID
 * @param changeInfo Tab change info
 * @param tab Tab data
 */
export function autolinkHandler(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): void {
  autolinkHandlerAsync(tabId, changeInfo, tab).catch((error) => {
    logError('Failed to handle autolink request', error);
  });
}

/**
 * Async handler for tab update reports for autolink content script
 * @param tabId Tab ID
 * @param changeInfo Tab change info
 * @param tab Tab data
 */
async function autolinkHandlerAsync(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (changeInfo.status !== 'complete') {
    return;
  }

  const stg = await getOptions('local', ['auto_link']);
  if (!stg.auto_link) {
    return;
  }

  const permissionResult = await checkContentScriptPermissions();
  if (!permissionResult) {
    await setOptions('local', {auto_link: false});
    logWarn(
      'Autolink handling is enabled but has insufficient content script permissions, disabling.'
    );
    return;
  }

  // tab.url requires optional tabs permission, so this needs to come after the check for
  // content script permissions.
  const exclude = await testAutolinkExclusion(tab.url || '');
  if (exclude) {
    return;
  }

  // Apply autolink content script
  const injectionResults = await chrome.scripting.executeScript({
    target: {tabId: tabId, allFrames: true},
    files: ['autolink.js'],
  });

  if (chrome.runtime.lastError || injectionResults === undefined) {
    logInfo(`Autolink failed to run on ${tab.url || ''}`);
  }
}

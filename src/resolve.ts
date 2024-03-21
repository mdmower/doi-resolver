/**
 * @license Apache-2.0
 */

import {TargetTab} from './custom_types';
import {getOptions, getDefaultOptions} from './options';

/**
 * Resolve DOI in the specified tab
 * @param doi DOI
 * @param useCustomResolver Whether to use a custom resolver
 * @param targetTab Target tab
 */
export async function resolveDoi(
  doi: string,
  useCustomResolver: boolean,
  targetTab?: TargetTab
): Promise<void> {
  const stg = await getOptions('local', ['doi_resolver', 'shortdoi_resolver']);
  const defaultResolver = getDefaultOptions()['doi_resolver'];

  let doiUrl: string;
  if (useCustomResolver) {
    if (/^10\//.test(doi)) {
      const shortDoiResolver = stg.shortdoi_resolver || defaultResolver;
      doiUrl = shortDoiResolver + doi.replace(/^10\//, '');
    } else {
      const doiResolver = stg.doi_resolver || defaultResolver;
      doiUrl = doiResolver + doi;
    }
  } else {
    if (/^10\//.test(doi)) {
      doiUrl = defaultResolver + doi.replace(/^10\//, '');
    } else {
      doiUrl = defaultResolver + doi;
    }
  }

  switch (targetTab) {
    case 'newForegroundTab':
      await chrome.tabs.create({url: doiUrl, active: true});
      break;
    case 'newBackgroundTab':
      await chrome.tabs.create({url: doiUrl, active: false});
      break;
    default: {
      // "currentTab"
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const tabId = tabs[0]?.id;
      if (tabId !== undefined) {
        await chrome.tabs.update(tabId, {url: doiUrl});
      }
      break;
    }
  }
}

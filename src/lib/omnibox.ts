/**
 * @license Apache-2.0
 */

import {resolveDoi} from './resolve';
import {getOptions, OmniboxTab} from './options';
import {isValidDoi, trimDoi} from './utils';
import {logError} from './logger';
import {showNotification} from './notification';
import {queueRecordDoi} from './history';

/**
 * Handle omnibox input entered events
 * @param text Text from omnibox
 * @param disposition Default tab where action should occur
 */
export function omniHandler(
  text: string,
  disposition: chrome.omnibox.OnInputEnteredDisposition
): void {
  omniHandlerAsync(text, disposition).catch((error) =>
    logError('Failed to handle omnibox input', error)
  );
}

/**
 * Async handler for omnibox input entered events
 * @param text Text from omnibox
 * @param disposition Default tab where action should occur
 */
async function omniHandlerAsync(
  text: string,
  disposition: chrome.omnibox.OnInputEnteredDisposition
) {
  const doiInput = encodeURI(trimDoi(text));
  if (!isValidDoi(doiInput)) {
    const notificationTitle = chrome.i18n.getMessage('invalidDoiTitle');
    const notificationMessage = chrome.i18n.getMessage('invalidDoiAlert');
    showNotification(notificationTitle, notificationMessage);
    return;
  }

  // This action doesn't qualify as a user gesture, so we can't request meta
  // permissions (i.e. re-establish them for free if they were removed). If
  // the permissions happen to be available, they will be used automatically
  // by during history update.
  await queueRecordDoi(doiInput);

  const stg = await getOptions('local', ['omnibox_tab', 'custom_resolver', 'cr_omnibox']);
  let tab: chrome.omnibox.OnInputEnteredDisposition;
  switch (stg.omnibox_tab) {
    case OmniboxTab.NewForegroundTab:
      tab = 'newForegroundTab';
      break;
    case OmniboxTab.NewBackgroundTab:
      tab = 'newBackgroundTab';
      break;
    case OmniboxTab.CurrentTab:
      tab = 'currentTab';
      break;
    default:
      tab = disposition;
      break;
  }

  await resolveDoi(doiInput, !!stg.custom_resolver && stg.cr_omnibox === 'custom', tab);
}

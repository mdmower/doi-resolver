/**
 * @license Apache-2.0
 */

import {checkMetaPermissions} from './permissions';
import {getDefaultOptions} from './options';
import {isObject} from './utils';
import {
  MessageCmd,
  OffscreenAction,
  OffscreenDocMessage,
  sendInternalMessageAsync,
} from './messaging';
import {logError, logInfo} from './logger';

/**
 * Fetch the title of a DOI
 * @param doi DOI
 */
export async function fetchDoiTitle(doi: string): Promise<string | undefined> {
  if (!(await checkMetaPermissions())) {
    return;
  }

  const fetchHeaders = new Headers();
  fetchHeaders.append('Accept', 'application/vnd.citationstyles.csl+json');

  const fetchInit: RequestInit = {
    method: 'GET',
    headers: fetchHeaders,
    cache: 'no-cache',
  };

  const jsonUrl = getDefaultOptions()['doi_resolver'] + doi;
  const fetchRequest = new Request(jsonUrl, fetchInit);

  try {
    const fetchResponse = await fetch(fetchRequest);
    if (!fetchResponse.ok) {
      if (fetchResponse.status === 404) {
        logInfo('Title not found for DOI: ', doi);
        return;
      }
      throw new Error(`Bad status code: ${fetchResponse.status}`);
    }
    const json: unknown = await fetchResponse.json();
    if (!isObject(json) || typeof json.title !== 'string') {
      return;
    }

    await chrome.offscreen.createDocument({
      justification: 'Fetched titles sometimes contain HTML markup that needs to be parsed.',
      reasons: ['DOM_PARSER'],
      url: 'offscreen.html',
    });

    let title: string | undefined;
    try {
      const messageResponse = await sendInternalMessageAsync<
        OffscreenDocMessage<string>,
        OffscreenDocMessage<string>
      >({
        cmd: MessageCmd.OffscreenDoc,
        data: {
          action: OffscreenAction.ParseTitle,
          data: json.title,
        },
      });

      const parsedTitle = messageResponse?.data?.data;
      if (typeof parsedTitle === 'string') {
        title = parsedTitle || undefined;
      }
    } catch (ex) {
      logError('Failed to send offscreen document message', ex);
    } finally {
      await chrome.offscreen.closeDocument();
    }

    return title;
  } catch (ex) {
    logError('fetchDoiTitle failed', ex);
  }
}

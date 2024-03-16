/**
 * @license Apache-2.0
 */

import {checkMetaPermissions} from './permissions';
import {getDefaultOptions} from './options';
import {isRecord} from './utils';
import {
  MessageCmd,
  OffscreenAction,
  OffscreenDocMessage,
  sendInternalMessageAsync,
} from './messaging';
import {logError, logInfo} from './logger';
import {parseTitles} from './pages/utils';

/**
 * Fetch the unsanitized title associated with a DOI
 * @param doi DOI
 */
async function fetchRawDoiTitle(doi: string): Promise<string | undefined> {
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
    const fetchResponse = await fetch(fetchRequest, {credentials: 'omit'});
    if (!fetchResponse.ok) {
      if (fetchResponse.status === 404) {
        logInfo(`Title not found for DOI: ${doi}`);
        return;
      }
      throw new Error(`Bad status code: ${fetchResponse.status}`);
    }

    const json: unknown = await fetchResponse.json();
    if (!isRecord(json) || typeof json.title !== 'string') {
      throw new Error('Invalid JSON response');
    }

    return json.title;
  } catch (ex) {
    logError(`Title fetch failed for DOI: ${doi}`, ex);
  }
}

/**
 * Fetch the titles associated with DOIs
 * @param dois DOIs
 */
export async function fetchDoiTitles(
  dois: string[]
): Promise<Record<string, string | undefined> | undefined> {
  if (!(await checkMetaPermissions())) {
    return;
  }

  if (!dois.length) {
    return {};
  }

  const uniqueDois = dois.filter((doi, i) => dois.indexOf(doi) === i);
  const rawTitles: Record<string, string | undefined> = {};

  const rawDoiTitlePromise = async (doi: string): Promise<void> => {
    rawTitles[doi] = await fetchRawDoiTitle(doi);
    const nextDoi = uniqueDois.pop();
    if (nextDoi) {
      return rawDoiTitlePromise(nextDoi);
    }
  };

  // Allow up to 4 simultaneous title fetches
  const rawTitleQueues: Promise<void>[] = [];
  for (let i = 0; i < 4; i++) {
    const nextDoi = uniqueDois.pop();
    if (nextDoi) {
      rawTitleQueues.push(rawDoiTitlePromise(nextDoi));
    } else {
      break;
    }
  }

  await Promise.all(rawTitleQueues);

  const {permissions} = await chrome.permissions.getAll();
  const needsOffscreen = !!permissions?.includes('offscreen');
  return needsOffscreen ? parseTitlesOffscreen(rawTitles) : parseTitles(rawTitles);
}

/**
 * Send raw titles to offscreen page for HTML parsing
 * @param rawTitles Raw DOI titles
 */
async function parseTitlesOffscreen(rawTitles: Record<string, string | undefined>) {
  try {
    await chrome.offscreen.createDocument({
      justification: 'Fetched titles sometimes contain HTML markup that needs to be parsed.',
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      url: 'offscreen.html',
    });

    try {
      const messageResponse = await sendInternalMessageAsync<
        OffscreenDocMessage<Record<string, string | undefined>>,
        OffscreenDocMessage<Record<string, string | undefined>>
      >({
        cmd: MessageCmd.OffscreenDoc,
        data: {
          action: OffscreenAction.ParseTitles,
          data: rawTitles,
        },
      });

      return messageResponse?.data?.data;
    } catch (ex) {
      logError('Failed to communicate with offscreen document', ex);
    } finally {
      await chrome.offscreen.closeDocument();
      // In the event that this method does get called in rapid succession,
      // add a delay here in hopes that it will avoid a "doc not closed" error.
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } catch (ex) {
    logError('Failed to parse DOI titles', ex);
  }
}

/**
 * Fetch the title associated with a DOI
 * @param doi DOI
 *
 * Do not call this function multiple times in rapid succession. Offscreen
 * documents do not close fast enough (even when awaited), and an error will
 * be thrown if a new offscreen document is requested before the last one is
 * completely closed.
 */
export async function fetchDoiTitle(doi: string): Promise<string | undefined> {
  const titlesRef = await fetchDoiTitles([doi]);
  return titlesRef?.[doi];
}

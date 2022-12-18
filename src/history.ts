/**
 * @license Apache-2.0
 */

import {logWarn} from './logger';
import {fetchDoiTitle} from './metadata';
import {getOptions, setOptions, getDefaultOptions, HistoryDoi} from './options';

/**
 * Get the title of a DOI stored in history
 * @param doi DOI
 */
export async function getSavedDoiTitle(doi: string): Promise<string | undefined> {
  const stg = await getOptions('local', ['history', 'recorded_dois']);
  if (!stg.history || !stg.recorded_dois) {
    return;
  }

  const entry = stg.recorded_dois.find((item) => item.doi === doi);
  return entry?.title;
}

/**
 * Queue a DOI to record in history (if feature is enabled)
 * @param doi DOI
 */
export async function queueRecordDoi(doi: string): Promise<void> {
  const stg = await getOptions('local', ['history', 'history_doi_queue']);
  if (stg.history) {
    if (stg.history_doi_queue) {
      stg.history_doi_queue.push(doi);
    } else {
      stg.history_doi_queue = [doi];
    }
    delete stg.history;
    await setOptions('local', stg);
  }
}

/**
 * Record a DOI in history
 * @param doi DOI
 * @param title Title of DOI (undefined if unknown)
 * @param allowFetch Whether to allow automatically fetching the title
 * (if needed and feature is enabled)
 */
export async function recordDoi(doi: string, title?: string, allowFetch = true): Promise<void> {
  const stg = await getOptions('local', [
    'history',
    'history_length',
    'history_fetch_title',
    'recorded_dois',
  ]);
  if (!stg.history) {
    return;
  }

  const defaultOptions = getDefaultOptions();
  if (!stg.recorded_dois) {
    stg.recorded_dois = defaultOptions['recorded_dois'];
  }
  if (!stg.history_length || stg.history_length < 1) {
    stg.history_length = defaultOptions['history_length'];
  }

  // Remove holes from the array (should not occur)
  stg.recorded_dois = stg.recorded_dois.filter(Boolean);

  /* The number of recorded entries may exceed the history length if
   * the user has saved N entries and later sets the history length to
   * less than N. Do not take action; only handle the case of equal
   * history length and number of entries below.
   */
  if (stg.recorded_dois.length > stg.history_length) {
    logWarn('Number of recorded DOIs exceeds history length option, aborting.');
    return;
  }

  const stgHistoryDoi = stg.recorded_dois.find((item) => item.doi === doi);
  if (stgHistoryDoi) {
    // DOI already exists in history, get/overwrite title if enabled.
    if (title) {
      if (stgHistoryDoi.title !== title) {
        stgHistoryDoi.title = title;
        await setOptions('local', {recorded_dois: stg.recorded_dois});
      }
    } else if (!stg.history_fetch_title || stgHistoryDoi.title || !allowFetch) {
      // Do nothing
    } else {
      title = await fetchDoiTitle(doi);
      if (title) {
        stgHistoryDoi.title = title;
        await setOptions('local', {recorded_dois: stg.recorded_dois});
      }
    }
  } else {
    // DOI does not yet exist in history, get title if enabled.
    if (stg.recorded_dois.length === stg.history_length) {
      // Do not remove saved entries
      const unsavedIndex = stg.recorded_dois.findIndex((entry) => !entry.save);
      if (unsavedIndex < 0) {
        logWarn("Number of recorded DOIs marked 'save' equals history length, aborting.");
        return;
      }
      stg.recorded_dois.splice(unsavedIndex, 1);
    }

    const historyDoi: HistoryDoi = {
      doi: doi,
      title: title || '',
      save: false,
    };

    if (!stg.history_fetch_title || title || !allowFetch) {
      // Do nothing
    } else {
      const title = await fetchDoiTitle(doi);
      if (title) {
        historyDoi.title = title;
      }
    }
    stg.recorded_dois.push(historyDoi);
    await setOptions('local', stg);
  }
}

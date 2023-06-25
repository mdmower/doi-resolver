/**
 * @license Apache-2.0
 */

import {logWarn} from './logger';
import {fetchDoiTitles} from './metadata';
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
 * Queue multiple DOIs to record in history (if feature is enabled)
 * @param dois DOIs
 */
export async function queueRecordDois(dois: string[]): Promise<void> {
  const stg = await getOptions('local', ['history', 'history_doi_queue']);
  if (stg.history) {
    if (stg.history_doi_queue) {
      stg.history_doi_queue.push(...dois);
    } else {
      stg.history_doi_queue = [...dois];
    }
    delete stg.history;
    await setOptions('local', stg);
  }
}

/**
 * Queue a DOI to record in history (if feature is enabled)
 * @param doi DOI
 */
export async function queueRecordDoi(doi: string): Promise<void> {
  await queueRecordDois([doi]);
}

/**
 * Record multiple DOIs in history
 * @param entries History DOI entries
 * @param allowFetch Whether to allow automatically fetching the title (if
 * needed and feature is enabled)
 */
export async function recordDois(entries: HistoryDoi[], allowFetch = true): Promise<void> {
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

  // Remove holes from the storage array (should not occur)
  stg.recorded_dois = stg.recorded_dois.filter(Boolean);

  // Deduplicate new DOIs
  entries = entries.filter((x, i) => entries.findIndex((y) => x.doi === y.doi) === i);

  // The number of recorded entries may exceed the history length if
  // the user has saved N entries and later sets the history length to
  // less than N. Check whether the number can be whittled down.
  while (stg.recorded_dois.length > stg.history_length) {
    // Do not remove saved entries
    const unsavedIndex = stg.recorded_dois.findIndex((entry) => !entry.save);
    if (unsavedIndex < 0) {
      logWarn('Number of saved DOIs exceeds history length option, aborting.');
      return;
    }
    stg.recorded_dois.splice(unsavedIndex, 1);
  }

  // Start by recording the DOIs with their provided titles
  const titleFetchDois: string[] = [];
  let stgModified = false;
  for (const {doi, title, save} of entries) {
    // Check whether we already have the DOI and if so, maybe update the title.
    // Do not revise the save status here.
    const recordedEntry = stg.recorded_dois.find((item) => item.doi === doi);
    if (recordedEntry) {
      if (title && recordedEntry.title !== title) {
        recordedEntry.title = title;
        stgModified = true;
      }
      continue;
    }

    // Do not exceed the length of history. Remove the oldest unsaved entry and
    // push the new entry. Note that if the import list is long and the max
    // history length is short, this will end up pushing out all of the old
    // unsaved entries and could even start pushing out the early entries in
    // this import list, but this is working as intended and is not expensive
    // because we don't save nor perform title lookups until the loop is done.
    if (stg.recorded_dois.length === stg.history_length) {
      // Do not remove saved entries
      const unsavedIndex = stg.recorded_dois.findIndex((entry) => !entry.save);
      if (unsavedIndex < 0) {
        continue;
      }
      stg.recorded_dois.splice(unsavedIndex, 1);
    }

    // Push the new entry and add to the list of DOIs for which titles should
    // be fetched, if necessary.
    stg.recorded_dois.push({doi, save, title});
    if (!title) {
      titleFetchDois.push(doi);
    }
    stgModified = true;
  }

  if (!stgModified) {
    return;
  }
  await setOptions('local', {recorded_dois: stg.recorded_dois});

  // If title fetch is not enabled, we're done.
  if (!allowFetch || !stg.history_fetch_title) {
    return;
  }

  // Fetch titles for the new DOIs
  stgModified = false;
  const fetchedTitles = await fetchDoiTitles(titleFetchDois);
  for (const doi of titleFetchDois) {
    const recordedEntry = stg.recorded_dois.find((item) => item.doi === doi);
    const title = fetchedTitles?.[doi];
    if (recordedEntry && title) {
      recordedEntry.title = title;
      stgModified = true;
    }
  }
  if (stgModified) {
    await setOptions('local', {recorded_dois: stg.recorded_dois});
  }
}

/**
 * Record a DOI in history
 * @param entry History DOI entry
 * @param allowFetch Whether to allow automatically fetching the title (if
 * needed and feature is enabled)
 *
 * Do not call this function multiple times in rapid succession. Offscreen
 * documents do not close fast enough (even when awaited), and an error will
 * be thrown if a new offscreen document is requested before the last one is
 * completely closed.
 */
export async function recordDoi(entry: HistoryDoi, allowFetch = true): Promise<void> {
  return recordDois([entry], allowFetch);
}

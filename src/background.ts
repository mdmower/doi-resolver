/**
 * @license Apache-2.0
 */

import {
  createContextMenu,
  ContextMenuId,
  updateContextMenu,
  removeContextMenu,
} from './context_menu';
import {recordDois} from './history';
import {logInfo, logWarn} from './logger';
import {HistoryDoi, getOptions, setOptions} from './options';

/**
 * Add context menu item
 */
export function addContextMenu(): void {
  createContextMenu(ContextMenuId.ResolveDoi);
}

/**
 * Reinit (remove and create) context menu
 *
 * TODO: This exists only to work around a bug in Firefox. Remove when
 * https://bugzilla.mozilla.org/show_bug.cgi?id=1817287 is fixed.
 */
export async function reinitContextMenu(): Promise<void> {
  await removeContextMenu(ContextMenuId.ResolveDoi);
  createContextMenu(ContextMenuId.ResolveDoi);
}

/**
 * Update context menu item
 */
export async function resetContextMenu(): Promise<void> {
  const stg = await getOptions('local', ['context_menu', 'context_menu_match']);
  updateContextMenu(ContextMenuId.ResolveDoi, !!stg.context_menu && !stg.context_menu_match);
}

/**
 * Process history DOI queue
 */
export async function processHistoryDoiQueue(): Promise<void> {
  const stg = await getOptions('local', ['history_doi_queue']);
  const queue = stg.history_doi_queue || [];
  if (queue.length > 0) {
    await setOptions('local', {history_doi_queue: []});
    logInfo(`DOI(s) queued for history: ${queue.join(', ')}`);
    try {
      const historyEntries = queue.map<HistoryDoi>((item) => ({doi: item, title: '', save: false}));
      await recordDois(historyEntries);
    } catch (ex) {
      logWarn(`Unable to record dois in history: ${queue.join(', ')}`, ex);
    }
  }
}

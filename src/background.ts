/**
 * @license Apache-2.0
 */

import {createContextMenu, ContextMenuId, updateContextMenu} from './context_menu';
import {recordDoi} from './history';
import {logInfo, logWarn} from './logger';
import {getOptions, setOptions} from './options';

/**
 * Add context menu item
 */
export function addContextMenu(): void {
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
      await Promise.all(queue.map((doi) => recordDoi(doi)));
    } catch (ex) {
      logWarn(`Unable to record dois in history: ${queue.join(', ')}`, ex);
    }
  }
}

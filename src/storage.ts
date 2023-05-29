/**
 * @license Apache-2.0
 */

import {processHistoryDoiQueue, resetContextMenu} from './background';
import {logError, logInfo} from './logger';
import {MessageCmd, SettingsUpdatedMessage, sendInternalMessageAsync} from './messaging';
import {
  StorageOptions,
  getAllOptionNames,
  getAllSyncOptionNames,
  getDefaultOptions,
  getDeprecatedOptionNames,
  getForceRefreshOptionNames,
  getOptions,
  removeOptions,
  setOptions,
  toStorageOptions,
} from './options';
import {getTypedKeys} from './utils';

const {storageListenerStatus} = new (class {
  private status: boolean = true;

  /**
   * Get/Set the flag indicating the storage listener status
   * @param enable Status to set for the storage listener or undefined to retrieve the status
   */
  public storageListenerStatus = (enable?: boolean): boolean => {
    if (enable !== undefined) {
      this.status = enable;
    }
    return this.status;
  };
})();

/**
 * Check for new options when the extension is updated
 * and update storage with their default values.
 */
export async function checkForNewOptions(): Promise<void> {
  const deprecatedOptionNames = getDeprecatedOptionNames();
  const optionNames = getAllOptionNames().filter((name) => !deprecatedOptionNames.includes(name));
  const stg = await getOptions('local', optionNames);

  const newOptions: Record<string, unknown> = {};
  let updateSettings = false;
  const defaultOptions = getDefaultOptions();
  optionNames.forEach((option) => {
    if (stg[option] === undefined) {
      newOptions[option] = defaultOptions[option];
      updateSettings = true;
    }
  });

  if (updateSettings) {
    await setOptions('local', newOptions);
  }
}

/**
 * Remove deprecated options from storage
 */
export async function removeDeprecatedOptions(): Promise<void> {
  const deprecatedOptions = getDeprecatedOptionNames();
  await removeOptions('local', deprecatedOptions);
  await removeOptions('sync', deprecatedOptions);
}

/**
 * Check whether all sync storageoptions have been cleared, in which case
 * sync should be disabled.
 */
export async function verifySyncState(): Promise<boolean> {
  const stg = await getOptions('sync');
  if (!Object.keys(stg).length) {
    logInfo('Sync settings cleared, disabling settings synchronization.');
    storageListenerStatus(false);
    await setOptions('local', {sync_data: false});
    storageListenerStatus(true);

    // If the options page is open, let it know sync should be unchecked.
    await sendInternalMessageAsync<SettingsUpdatedMessage, undefined>({
      cmd: MessageCmd.SettingsUpdated,
      data: {options: {sync_data: false}, forceUpdate: true},
    });

    return false;
  }

  return true;
}

/**
 * Enable sync feature
 */
export async function enableSync(): Promise<void> {
  // Sync was just toggled 'on', so let sync storage options overwrite
  // local storage options, so long as they are defined. If an option
  // is not defined in sync storage, copy it from local storage, which
  // is guaranteed to exist since checkForNewOptions() runs at start-up.

  const toLocal: Record<string, unknown> = {};
  const toSync: Record<string, unknown> = {};

  const stgLocal = await getOptions('local');
  const stgSync = await getOptions('sync');
  getAllSyncOptionNames().forEach((option) => {
    if (stgSync[option] !== undefined) {
      toLocal[option] = stgSync[option];
    } else {
      toSync[option] = stgLocal[option];
    }
  });
  logInfo('.. toSync: ', toSync);
  logInfo('.. toLocal: ', toLocal);
  const toSyncOptions = toStorageOptions(toSync);
  const toLocalOptions = toStorageOptions(toLocal);

  storageListenerStatus(false);
  await setOptions('sync', toSyncOptions);
  await setOptions('local', toLocalOptions);
  storageListenerStatus(true);

  await sendInternalMessageAsync<SettingsUpdatedMessage, undefined>({
    cmd: MessageCmd.SettingsUpdated,
    data: {
      options: toLocalOptions,
      forceUpdate: true,
    },
  });
}

/**
 * Handle changes reported by the storage listener
 * @param changes Storage changes
 * @param area Storage area
 */
export function storageChangeHandler(
  changes: Record<string, chrome.storage.StorageChange | undefined>,
  area: chrome.storage.AreaName
): void {
  storageChangeHandlerAsync(changes, area).catch((error) => {
    logError('Failed to handle storage changes', error);
  });
}

/**
 * Async handler for changes reported by the storage listener
 * @param changes Storage changes
 * @param area Storage area
 */
async function storageChangeHandlerAsync(
  changes: Record<string, chrome.storage.StorageChange | undefined>,
  area: chrome.storage.AreaName
): Promise<void> {
  // Debugging
  // logInfo(`Change in ${area} storage\n`, changes);

  if (!storageListenerStatus()) {
    logInfo(`Storage listener disabled, skipping changes in ${area}.`);
    return;
  }

  const updatedOptions = toStorageOptions(
    Object.keys(changes).reduce<Record<string, unknown>>((prev, curr) => {
      prev[curr] = changes[curr]?.newValue;
      return prev;
    }, {})
  );

  if (area === 'local') {
    await refreshBackgroundFeatures(updatedOptions);
  }

  // Note that sync_data is in the sync exclusions list, so is only ever set in the local area.
  if (area === 'local' && updatedOptions.sync_data !== undefined) {
    if (updatedOptions.sync_data) {
      logInfo('Settings synchronization enabled.');
      await enableSync();
      // When settings are imported from sync to local, the storage listener is disabled.
      // Calculation of which options need to be set in local/sync storage and then
      // reported via internal messaging is best handled in enableSync(). Return early.
      return;
    } else {
      logInfo('Settings synchronization disabled.');
    }
  }

  // Determine whether sync is enabled
  let syncEnabled = (await getOptions('local', ['sync_data'])).sync_data ?? false;

  // When sync storage changes are reported, check whether all options have been cleared,
  // in which case sync should be disabled.
  if (syncEnabled && area === 'sync') {
    syncEnabled = await verifySyncState();
  }

  const syncOptionNames = getAllSyncOptionNames();
  const updatedSyncOptions = toStorageOptions(
    getTypedKeys(updatedOptions).reduce<Record<string, unknown>>((prev, curr) => {
      if (syncOptionNames.includes(curr)) {
        prev[curr] = updatedOptions[curr];
      }
      return prev;
    }, {})
  );
  const hasUpdatedSyncSettings = Object.keys(updatedSyncOptions).length > 0;

  if (syncEnabled && hasUpdatedSyncSettings) {
    const newArea: chrome.storage.AreaName = area === 'local' ? 'sync' : 'local';
    // Debugging
    // if (area === 'local') {
    //   logInfo('.. toSync: ', updatedSyncOptions);
    // } else {
    //   logInfo('.. toLocal: ', updatedSyncOptions);
    // }

    // This looks scary without surrounding setOptions() by a storage listener
    // status toggle: "won't this cause an infinite loop of settings updates
    // between local and sync?" In practice, a deep compare is performed before
    // changes are reported, so if nothing is actually updated in an area, then
    // no storage change event is reported.
    await setOptions(newArea, updatedSyncOptions);
  }

  // Only send messages when the local area is updated. This works because sync
  // settings updates are always duplicated to the local area just above and
  // thus avoids redundant notices.
  //
  // We only need to send updatedSyncOptions because local-only option changes
  // are handled by local event listeners.
  if (area === 'local' && hasUpdatedSyncSettings) {
    // Debugging
    // logInfo(`Sending updated settings notification\n`, updatedSyncOptions);

    const forceUpdate = getForceRefreshOptionNames().some(
      (optionName) => updatedSyncOptions[optionName] !== undefined
    );

    await sendInternalMessageAsync<SettingsUpdatedMessage, undefined>({
      cmd: MessageCmd.SettingsUpdated,
      data: {options: updatedSyncOptions, forceUpdate},
    });
  }
}

/**
 * Refresh the state of background features
 * @param updatedOptions Updated options from storage change handler
 */
async function refreshBackgroundFeatures(updatedOptions: StorageOptions): Promise<void> {
  if (updatedOptions.context_menu !== undefined) {
    await resetContextMenu();
  }
  if (updatedOptions.history_doi_queue !== undefined) {
    await processHistoryDoiQueue();
  }
}

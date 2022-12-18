/**
 * @license Apache-2.0
 */

import {processHistoryDoiQueue, resetContextMenu} from './background';
import {logError, logInfo} from './logger';
import {MessageCmd, SettingsUpdatedMessage, sendInternalMessageAsync} from './messaging';
import {
  StorageOptions,
  getAllOptionNames,
  getDefaultOptions,
  getDeprecatedOptionNames,
  getOptions,
  getSyncExclusionNames,
  removeOptions,
  setOptions,
  toStorageOptions,
} from './options';
import {getTypedKeys} from './utils';

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
export async function verifySyncState(): Promise<void> {
  const stgLocal = await getOptions('local', ['sync_data']);
  const stgSync = await getOptions('sync');
  if (stgLocal.sync_data && !Object.keys(stgSync).length) {
    await storageListenerStatus(false);
    logInfo('Sync settings cleared, disabling settings synchronization');
    await setOptions('local', {sync_data: false});
    await storageListenerStatus(true);

    // If the options page is open, let it know sync should be unchecked.
    await sendInternalMessageAsync<SettingsUpdatedMessage, undefined>({
      cmd: MessageCmd.SettingsUpdated,
      data: {options: {sync_data: false}, forceUpdate: true},
    });
  }
}

/**
 * Enable sync feature
 */
export async function enableSync(): Promise<void> {
  await storageListenerStatus(false);

  // Sync was just toggled 'on', so let sync storage options overwrite
  // local storage options, so long as they are defined. If an option
  // is not defined in sync storage, copy it from local storage, which
  // is guaranteed to exist since checkForNewOptions() runs at start-up.

  const toLocal: Record<string, unknown> = {};
  const toSync: Record<string, unknown> = {};
  const syncExclusionNames = getSyncExclusionNames();
  const syncOptionNames = getAllOptionNames().filter((name) => !syncExclusionNames.includes(name));

  const stgLocal = await getOptions('local');
  const stgSync = await getOptions('sync');
  syncOptionNames.forEach((option) => {
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
  await setOptions('sync', toSyncOptions);
  await setOptions('local', toLocalOptions);

  await storageListenerStatus(true);
  await sendInternalMessageAsync<SettingsUpdatedMessage, undefined>({
    cmd: MessageCmd.SettingsUpdated,
    data: {
      options: toLocalOptions,
      forceUpdate: true,
    },
  });
}

/**
 * Get/Set the flag indicating the storage listener status
 * @param enable Status to set for the storage listener or undefined to retrieve the status
 */
async function storageListenerStatus(enable?: boolean): Promise<boolean> {
  if (enable === undefined) {
    const stg = await getOptions('local', ['storage_listener_disabled']);
    return !stg.storage_listener_disabled;
  }

  await setOptions('local', {storage_listener_disabled: !enable});
  return enable;
}

/**
 * Handle changes reported by the storage listener
 * @param changes Storage changes
 * @param area Storage area
 */
export function storageChangeHandler(
  changes: {[key: string]: chrome.storage.StorageChange | undefined},
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
  changes: {[key: string]: chrome.storage.StorageChange | undefined},
  area: chrome.storage.AreaName
): Promise<void> {
  // Debugging
  // logInfo(`Change in ${area} storage\n`, changes);

  // storage_listener_disabled is always set in isolation and only locally.
  // When sync_data is enabled, storage_listener_disabled gets toggled-on/off.
  // Since this toggle happens within this change handler, it can lead to an
  // infinite loop if not ignored.
  if (changes['storage_listener_disabled'] !== undefined) {
    return;
  }

  if (!(await storageListenerStatus())) {
    return;
  }

  const updatedOptionsUnsafe = Object.keys(changes).reduce((prev, curr) => {
    prev[curr] = changes[curr]?.newValue;
    return prev;
  }, {} as Record<string, unknown>);
  const updatedOptions = toStorageOptions(updatedOptionsUnsafe);

  if (area === 'local') {
    await refreshBackgroundFeatures(updatedOptions);
  }

  // Note that sync_data is in the sync exclusions list, so is only
  // ever set in chrome.storage.local.
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

  // When sync storage changes are reported, check whether all options have been cleared,
  // in which case sync should be disabled.
  if (area === 'sync') {
    await verifySyncState();
  }

  const syncExclusionNames = getSyncExclusionNames();
  const syncOptionNames = getAllOptionNames().filter((name) => !syncExclusionNames.includes(name));
  const updatedSyncOptions = toStorageOptions(
    getTypedKeys(updatedOptions).reduce((prev, curr) => {
      if (syncOptionNames.includes(curr)) {
        prev[curr] = updatedOptions[curr];
      }
      return prev;
    }, {} as Record<string, unknown>)
  );

  const forceRefreshOptionNames: (keyof StorageOptions)[] = [
    'cr_history',
    'custom_resolver',
    'doi_resolver',
    'history_sortby',
    'recorded_dois',
    'shortdoi_resolver',
  ];

  const forceUpdate = forceRefreshOptionNames.some(
    (optionName) => updatedSyncOptions[optionName] !== undefined
  );

  const stg = await getOptions('local', ['sync_data']);
  if (stg.sync_data) {
    const newArea: chrome.storage.AreaName = area === 'local' ? 'sync' : 'local';
    await storageListenerStatus(false);
    await setOptions(newArea, updatedSyncOptions);
    await storageListenerStatus(true);
  }

  // Only need to send message with updated sync options because local option
  // changes are handled by local event listeners.
  await sendInternalMessageAsync<SettingsUpdatedMessage, undefined>({
    cmd: MessageCmd.SettingsUpdated,
    data: {options: updatedSyncOptions, forceUpdate},
  });
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

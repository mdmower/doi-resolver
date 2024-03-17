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
import deepEqual from 'fast-deep-equal/es6';

// CAUTION: Each entry point file gets its own copy of this listener status
// instance. So, for example, if setOptions() were to incorporate it, the
// service worker and options page would reference independent instances and
// ultimately, the storage change handler in the service worker would not be
// aware that the options page requested that the change handler be temporarily
// disabled. So long as the use of this instance is restricted to the service
// worker only, it will work as intended. If it becomes necessary to expand the
// scope of this listener status to all entry point files, then refer to version
// 6.0.0 of this extension when setting 'storage_listener_disabled' was used.
const {storageListenerStatus} = new (class {
  private status: boolean = true;
  private skips: number = 0;
  private skipTimeouts: ReturnType<typeof setTimeout>[] = [];

  /**
   * Get/Set the flag indicating the storage listener status
   * @param options Options to update the status of the storage listener or undefined to retrieve the status
   * @param options.enable Status to set for the storage listener
   * @param options.skip Whether the next status check should be skipped
   */
  public storageListenerStatus = (options?: {enable?: boolean; skip?: boolean}): boolean => {
    if (!options) {
      if (this.skips > 0) {
        clearTimeout(this.skipTimeouts.pop());
        this.skips -= 1;
        // Debugging
        // logInfo(
        //   `Cleared skip timeout and decremented skips to: ${this.skips} (timeouts remaining: [${this.skipTimeouts.toString()}])`
        // );
        return false;
      }
      return this.status;
    }

    const {enable, skip} = options;
    if (enable !== undefined) {
      this.status = enable;
    }
    if (skip !== undefined) {
      this.skips += 1;
      // Debugging
      // logInfo('Incremented skips to: ' + this.skips);
      this.skipTimeouts.push(
        setTimeout(() => {
          this.skipTimeouts.pop();
          if (this.skips > 0) {
            this.skips -= 1;
          }
          // Debugging
          // logInfo(
          //   `Skip timeout reached and decremented skips to: ${this.skips} (timeouts remaining: [${this.skipTimeouts.toString()}])`
          // );
        }, 100)
      );
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
  let syncEnabled = (await getOptions('local', ['sync_data']))['sync_data'] ?? false;
  if (syncEnabled) {
    const stg = await getOptions('sync');
    if (!Object.keys(stg).length) {
      logInfo('Sync settings cleared, disabling settings synchronization');
      storageListenerStatus({skip: true});
      await setOptions('local', {sync_data: false});
      syncEnabled = false;

      // If the options page is open, let it know sync should be unchecked.
      await sendInternalMessageAsync<SettingsUpdatedMessage, undefined>({
        cmd: MessageCmd.SettingsUpdated,
        data: {options: {sync_data: false}, forceUpdate: true},
      });
    }
  }

  return syncEnabled;
}

/**
 * Enable sync feature
 */
async function enableSync(): Promise<void> {
  // Sync was just toggled 'on', so let sync storage options overwrite
  // local storage options, so long as they are defined. If an option
  // is not defined in sync storage, copy it from local storage, which
  // is guaranteed to exist since checkForNewOptions() runs on install
  // and update.

  const toLocal: Record<string, unknown> = {};
  const toSync: Record<string, unknown> = {};

  const [stgLocal, stgSync] = await Promise.all([getOptions('local'), getOptions('sync')]);
  for (const option of getAllSyncOptionNames()) {
    if (stgSync[option] !== undefined) {
      toLocal[option] = stgSync[option];
    } else {
      toSync[option] = stgLocal[option];
    }
  }

  const toSyncOptions = toStorageOptions(toSync);
  if (Object.keys(toSyncOptions).length) {
    // Debugging
    // logInfo('.. toSync: ', toSyncOptions);
    storageListenerStatus({skip: true});
    await setOptions('sync', toSyncOptions);
  }

  const toLocalOptions = toStorageOptions(toLocal);
  if (Object.keys(toLocalOptions).length) {
    // Debugging
    // logInfo('.. toLocal: ', toLocalOptions);
    storageListenerStatus({skip: true});
    await setOptions('local', toLocalOptions);
  }

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
  if (!storageListenerStatus()) {
    // Debugging
    // logInfo(`Storage listener disabled, skipping changes in ${area}.`);
    return;
  }

  // Firefox does not filter change reports to values that actually changed
  const filteredChanges = Object.entries(changes).reduce<typeof changes>((result, [key, chg]) => {
    if (chg && !deepEqual(chg.newValue, chg.oldValue)) {
      result[key] = chg;
    }
    return result;
  }, {});

  if (!Object.keys(filteredChanges).length) {
    return;
  }

  // Debugging
  // logInfo(`Change in ${area} storage\n`, filteredChanges);
  logInfo(`Processing changes in ${area} storage`);

  const updatedOptions = toStorageOptions(
    Object.keys(filteredChanges).reduce<Record<string, unknown>>((result, key) => {
      result[key] = filteredChanges[key]?.newValue;
      return result;
    }, {})
  );

  if (area === 'local') {
    await refreshBackgroundFeatures(updatedOptions);
  }

  // Note that sync_data is in the sync exclusions list, so is only ever set in the local area.
  if (area === 'local' && updatedOptions.sync_data !== undefined) {
    if (updatedOptions.sync_data) {
      logInfo('Settings synchronization enabled');
      await enableSync();
      // When settings are imported from sync to local, the storage listener is disabled.
      // Calculation of which options need to be set in local/sync storage and then
      // reported via internal messaging is best handled in enableSync(). Return early.
      return;
    } else {
      logInfo('Settings synchronization disabled');
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
    getTypedKeys(updatedOptions).reduce<Record<string, unknown>>((result, key) => {
      if (syncOptionNames.includes(key)) {
        result[key] = updatedOptions[key];
      }
      return result;
    }, {})
  );
  const hasUpdatedSyncSettings = Object.keys(updatedSyncOptions).length > 0;

  if (syncEnabled && hasUpdatedSyncSettings) {
    const newArea: chrome.storage.AreaName = area === 'local' ? 'sync' : 'local';

    const currentSettings = await getOptions(newArea);
    const filteredUpdates = getTypedKeys(updatedSyncOptions).reduce<Record<string, unknown>>(
      (result, key) => {
        if (!deepEqual(currentSettings[key], updatedSyncOptions[key])) {
          result[key] = updatedSyncOptions[key];
        }
        return result;
      },
      {}
    );

    if (Object.keys(filteredUpdates).length) {
      // Debugging
      // logInfo(newArea === 'sync' ? '.. toSync: ' : '.. toLocal: ', filteredUpdates);
      await setOptions(newArea, filteredUpdates);
    }
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

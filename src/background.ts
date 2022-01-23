/**
 * @license Apache-2.0
 */

import {
  HistoryDoi,
  OmniboxTab,
  StorageOptions,
  getAllOptionNames,
  getDefaultOptions,
  getDeprecatedOptionNames,
  getOptions,
  getSyncExclusionNames,
  removeOptions,
  setOptions,
  toStorageOptions,
} from './storage';
import {
  checkContentScriptPermissions,
  checkMetaPermissions,
  cleanupOriginPermissions,
  removeMetaPermissions,
} from './permissions';
import {
  AutolinkVarsMessage,
  MessageCmd,
  SettingsUpdatedMessage,
  isAutolinkVarsMessage,
  isContextMenuToggleMessage,
  isInternalMessage,
  sendInternalMessage,
} from './messaging';
import {getTypedKeys, isObject, trimDoi} from './utils';

declare global {
  interface Window {
    // Allow other pages to read public instances of
    // initialized classes.
    doiBackground: DoiBackground;
  }
}

export type TargetTab = chrome.omnibox.OnInputEnteredDisposition;

document.addEventListener(
  'DOMContentLoaded',
  function () {
    const doiBackground = new DoiBackground();
    window.doiBackground = doiBackground;
    doiBackground.init().catch((error) => {
      console.error('Init failed', error);
    });
  },
  false
);

class DoiBackground {
  private storageListenerStatus_: boolean;
  private contextMenuStatus_: boolean;
  private openTabs_: number[];
  private defaultResolver_: string;

  private handlers_: {
    autolinkHandler: (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => void;
    contextMenuMatchHandler: (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => void;
    omniHandler: (text: string, disposition: chrome.omnibox.OnInputEnteredDisposition) => void;
    runtimeMessageHandler: (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => boolean | void;
    storageChangeHandler: (
      changes: {
        [key: string]: chrome.storage.StorageChange | undefined;
      },
      area: chrome.storage.AreaName
    ) => void;
    tabRemovedHandler: (tabId: number) => void;
  };

  constructor() {
    this.storageListenerStatus_ = true;
    this.contextMenuStatus_ = false;
    this.openTabs_ = [];
    this.defaultResolver_ = getDefaultOptions()['doi_resolver'];

    this.handlers_ = {
      autolinkHandler: this.autolinkHandler.bind(this),
      contextMenuMatchHandler: this.contextMenuMatchHandler.bind(this),
      omniHandler: this.omniHandler.bind(this),
      runtimeMessageHandler: this.runtimeMessageHandler.bind(this),
      storageChangeHandler: this.storageChangeHandler.bind(this),
      tabRemovedHandler: this.tabRemovedHandler.bind(this),
    };
  }

  /**
   * Initialize background page
   */
  async init(): Promise<void> {
    await this.removeDeprecatedOptions();
    await this.verifySyncState();
    await this.cleanupPermissions();
    await this.checkForNewOptions();
    await this.startBackgroundFeatures();
    this.startListeners();
  }

  /**
   * Start listeners
   */
  private startListeners(): void {
    chrome.storage.onChanged.addListener(this.handlers_.storageChangeHandler);
    chrome.omnibox.onInputEntered.addListener(this.handlers_.omniHandler);
    chrome.tabs.onRemoved.addListener(this.handlers_.tabRemovedHandler);
    chrome.runtime.onMessage.addListener(this.handlers_.runtimeMessageHandler);
  }

  /**
   * Cleanup permissions that are not actively in-use.
   */
  private async cleanupPermissions(): Promise<boolean> {
    const stg = await getOptions('local', ['auto_link', 'context_menu_match']);
    const removeWildcardOrigins = !stg.auto_link && !stg.context_menu_match;
    return await cleanupOriginPermissions(removeWildcardOrigins);
  }

  /**
   * Check for new options when the extension is updated
   * and update storage with their default values.
   */
  private async checkForNewOptions(): Promise<void> {
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
  private async removeDeprecatedOptions(): Promise<void> {
    await removeOptions('sync', ['sync_reset']);
  }

  /**
   * Check whether all sync storageoptions have been cleared, in which case
   * sync should be disabled.
   */
  private async verifySyncState(): Promise<void> {
    const stgLocal = await getOptions('local', ['sync_data']);
    const stgSync = await getOptions('sync');
    if (stgLocal.sync_data && !Object.keys(stgSync).length) {
      this.setStorageListenerStatus(false);
      console.log('Sync settings cleared, disabling settings synchronization');
      await setOptions('local', {sync_data: false});
      this.setStorageListenerStatus(true);
    }
  }

  /**
   * Enable sync feature
   */
  private async enableSync(): Promise<void> {
    this.setStorageListenerStatus(false);

    // Sync was just toggled 'on', so let sync storage options overwrite
    // local storage options, so long as they are defined. If an option
    // is not defined in sync storage, copy it from local storage, which
    // is guaranteed to exist since checkForNewOptions() runs at start-up.

    const toLocal: Record<string, unknown> = {};
    const toSync: Record<string, unknown> = {};
    const syncExclusionNames = getSyncExclusionNames();
    const syncOptionNames = getAllOptionNames().filter(
      (name) => !syncExclusionNames.includes(name)
    );

    const stgLocal = await getOptions('local');
    const stgSync = await getOptions('sync');
    syncOptionNames.forEach((option) => {
      if (stgSync[option] !== undefined) {
        toLocal[option] = stgSync[option];
      } else {
        toSync[option] = stgLocal[option];
      }
    });
    console.log('.. toSync: ', toSync);
    console.log('.. toLocal: ', toLocal);
    const toSyncOptions = toStorageOptions(toSync);
    const toLocalOptions = toStorageOptions(toLocal);
    await setOptions('sync', toSyncOptions);
    await setOptions('local', toLocalOptions);

    this.setStorageListenerStatus(true);
    sendInternalMessage<SettingsUpdatedMessage, undefined>({
      cmd: MessageCmd.SettingsUpdated,
      data: {
        options: toLocalOptions,
        forceUpdate: true,
      },
    });
  }

  /**
   * Set a flag indicating the storage listener status
   * @param enable Status of storage listener
   */
  private setStorageListenerStatus(enable: boolean) {
    this.storageListenerStatus_ = enable;
  }

  /**
   * Handle changes reported by the storage listener
   * @param changes Storage changes
   * @param area Storage area
   */
  private storageChangeHandler(
    changes: {[key: string]: chrome.storage.StorageChange | undefined},
    area: chrome.storage.AreaName
  ): void {
    // TODO: Disable debugging
    // Debugging
    console.log(`Change in ${area} storage\n`, changes);

    const updatedOptionsUnsafe = Object.keys(changes).reduce((prev, curr) => {
      prev[curr] = changes[curr]?.newValue;
      return prev;
    }, {} as Record<string, unknown>);
    const updatedOptions = toStorageOptions(updatedOptionsUnsafe);

    this.storageChangeHandlerAsync(updatedOptions, area).catch((error) => {
      console.error('Failed to handle storage changes', error);
    });
  }

  /**
   * Handle changes reported by the storage listener
   * @param updatedOptions Updated options from storage change handler
   * @param area Storage area
   */
  private async storageChangeHandlerAsync(
    updatedOptions: StorageOptions,
    area: chrome.storage.AreaName
  ): Promise<void> {
    if (!this.storageListenerStatus_) {
      return;
    }

    if (area === 'local') {
      await this.updateBackgroundFeatureStates(updatedOptions);
    }

    // Note that sync_data is in the sync exclusions list, so is only
    // ever set in chrome.storage.local.
    if (area === 'local' && updatedOptions.sync_data !== undefined) {
      if (updatedOptions.sync_data) {
        console.log('Settings synchronization enabled.');
        await this.enableSync();
        // When settings are imported from sync to local, the storage listener is disabled.
        // Calculation of which options need to be set in local/sync storage and then
        // reported via internal messaging is best handled in enableSync(). Return early.
        return;
      } else {
        console.log('Settings synchronization disabled.');
      }
    }

    // When sync storage changes are report, check whether all options have been cleared,
    // in which case sync should be disabled.
    if (area === 'sync') {
      await this.verifySyncState();
    }

    const syncExclusionNames = getSyncExclusionNames();
    const syncOptionNames = getAllOptionNames().filter(
      (name) => !syncExclusionNames.includes(name)
    );
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
      this.setStorageListenerStatus(false);
      await setOptions(newArea, updatedSyncOptions);
      this.setStorageListenerStatus(true);
    }

    // Only need to send message with updated sync options because local option
    // changes are handled by local event listeners.
    sendInternalMessage<SettingsUpdatedMessage, undefined>({
      cmd: MessageCmd.SettingsUpdated,
      data: {options: updatedSyncOptions, forceUpdate},
    });
  }

  /**
   * Start background page features
   */
  private async startBackgroundFeatures(): Promise<void> {
    const stg = await getOptions('local', ['auto_link', 'context_menu', 'context_menu_match']);

    const getAutolinkDoisPromise = async (enable: boolean) => {
      if (enable) {
        const enabled = await this.setAutolinkOption();
        if (!enabled) {
          console.log(
            'Autolink was enabled in settings, but had to be disabled since necessary permissions are not available'
          );
        }
      }
    };

    const getContextMenuMatchPromise = async (enable: boolean) => {
      if (enable) {
        const enabled = await this.setContextMenuMatchOption();
        if (!enabled) {
          console.log(
            'Context menu match was enabled in settings, but had to be disabled since necessary permissions are not available'
          );
          if (stg.context_menu) {
            this.toggleContextMenu(true);
          }
        }
      } else {
        if (stg.context_menu) {
          this.toggleContextMenu(true);
        }
      }
    };

    await Promise.all([
      getAutolinkDoisPromise(!!stg.auto_link),
      getContextMenuMatchPromise(!!stg.context_menu && !!stg.context_menu_match),
    ]);
    this.setStorageListenerStatus(true);
  }

  /**
   * Update the state of background page features
   * @param updatedOptions Updated options from storage change handler
   */
  private async updateBackgroundFeatureStates(updatedOptions: StorageOptions): Promise<void> {
    if (updatedOptions.context_menu !== undefined) {
      this.toggleContextMenu(updatedOptions.context_menu);
    }

    if (updatedOptions.history_doi_queue !== undefined) {
      const queue = updatedOptions.history_doi_queue;
      if (queue.length > 0) {
        await setOptions('local', {history_doi_queue: []});
        console.log(`DOI(s) queued for history: ${queue.join(', ')}`);
        try {
          await Promise.all(queue.map((doi) => this.recordDoi(doi)));
        } catch (ex) {
          console.warn(`Unable to record dois in history: ${queue.join(', ')}`, ex);
        } finally {
          // TODO: Remove this?
          await removeMetaPermissions();
        }
      }
    }
  }

  /**
   * Navigate to a URL in the current window
   * @param url URL
   */
  private navigate(url: string): void {
    chrome.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      (tabs) => {
        const id = tabs[0].id;
        if (id !== undefined) {
          chrome.tabs.update(id, {url}, undefined);
        }
      }
    );
  }

  /**
   * Resolve DOI in the specified tab
   * @param doi DOI
   * @param useCustomResolver Whether to use a custom resolver
   * @param targetTab Target tab
   */
  public async resolveDoi(
    doi: string,
    useCustomResolver: boolean,
    targetTab?: TargetTab
  ): Promise<void> {
    const stg = await getOptions('local', ['doi_resolver', 'shortdoi_resolver']);

    let doiUrl;
    if (useCustomResolver) {
      if (/^10\//.test(doi)) {
        const shortDoiResolver = stg.shortdoi_resolver || this.defaultResolver_;
        doiUrl = shortDoiResolver + doi.replace(/^10\//, '');
      } else {
        const doiResolver = stg.doi_resolver || this.defaultResolver_;
        doiUrl = doiResolver + doi;
      }
    } else {
      if (/^10\//.test(doi)) {
        doiUrl = this.defaultResolver_ + doi.replace(/^10\//, '');
      } else {
        doiUrl = this.defaultResolver_ + doi;
      }
    }

    switch (targetTab) {
      case 'newForegroundTab':
        chrome.tabs.create({url: doiUrl, active: true}, undefined);
        break;
      case 'newBackgroundTab':
        chrome.tabs.create({url: doiUrl, active: false}, undefined);
        break;
      default:
        // "currentTab"
        this.navigate(doiUrl);
        break;
    }
  }

  /**
   * Fetch the title of a DOI
   * @param doi DOI
   */
  public async fetchDoiTitle(doi: string): Promise<string | undefined> {
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

    const jsonUrl = this.defaultResolver_ + doi;
    const fetchRequest = new Request(jsonUrl, fetchInit);

    try {
      const response = await fetch(fetchRequest);
      if (!response.ok) {
        throw new Error(`Bad status code: ${response.status}`);
      }
      const json: unknown = await response.json();
      if (!isObject(json) || typeof json.title !== 'string') {
        return;
      }

      const container = document.createElement('div');
      container.innerHTML = json.title;
      let firstChild = container.firstElementChild;
      while (firstChild) {
        if (firstChild.tagName === 'SUBTITLE' && firstChild.textContent) {
          container.replaceChild(
            document.createTextNode(` - ${firstChild.textContent}`),
            firstChild
          );
        } else if (firstChild.tagName === 'ALT-TITLE' || !firstChild.textContent?.trim()) {
          container.removeChild(firstChild);
        } else {
          container.replaceChild(document.createTextNode(firstChild.textContent), firstChild);
        }
        firstChild = container.firstElementChild;
      }

      return container.textContent?.replace(/\s{2,}/g, ' ').trim() || undefined;
    } catch (ex) {
      console.log('fetchDoiTitle failed', ex);
    }
  }

  /**
   * Get the title of a DOI stored in history
   * @param doi DOI
   */
  public async getSavedDoiTitle(doi: string): Promise<string | undefined> {
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
  public async queueRecordDoi(doi: string): Promise<void> {
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
  public async recordDoi(doi: string, title?: string, allowFetch = true): Promise<void> {
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
      console.warn('Number of recorded DOIs exceeds history length option, aborting.');
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
        title = await this.fetchDoiTitle(doi);
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
          console.warn("Number of recorded DOIs marked 'save' equals history length, aborting.");
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
        const title = await this.fetchDoiTitle(doi);
        if (title) {
          historyDoi.title = title;
        }
      }
      stg.recorded_dois.push(historyDoi);
      await setOptions('local', stg);
    }
  }

  /**
   * Enable/disable the context menu feature
   * @param enable Whether the feature should be enabled
   * @param doi Selected text
   */
  public toggleContextMenu(enable?: boolean, doi?: string): void {
    if (this.contextMenuStatus_ === enable) {
      return;
    }
    this.contextMenuStatus_ = !!enable;

    chrome.contextMenus.removeAll(() => {
      if (enable) {
        const resolveDoiText = chrome.i18n.getMessage('contextText');
        chrome.contextMenus.create({
          title: doi ? `${resolveDoiText} "${doi}"` : resolveDoiText,
          type: 'normal',
          contexts: ['selection'],
          onclick: this.contextMenuResolve.bind(this),
        });
      }
    });
  }

  /**
   * Handle the context menu feature click
   * @param info OnClick event data
   */
  private contextMenuResolve(info: chrome.contextMenus.OnClickData): void {
    this.contextMenuResolveAsync(info.selectionText || '').catch((error) => {
      console.error('Failed to handle context menu click', error);
    });
  }

  /**
   * Async handling for the context menu feature click
   * @param text Selection text
   */
  private async contextMenuResolveAsync(text: string): Promise<void> {
    // https://stackoverflow.com/questions/27910/finding-a-doi-in-a-document-or-page
    const doiRegex = /\b(10\.[0-9]{4,}(?:\.[0-9]+)*\/(?:(?!["&'<>])\S)+)\b/i;
    const doiMatch = doiRegex.exec(text);
    const doi = doiMatch ? doiMatch[1] : '';
    if (!doi) {
      alert(chrome.i18n.getMessage('invalidDoiAlert'));
      return;
    }

    const stg = await getOptions('local', ['custom_resolver', 'cr_context']);
    const cr = stg.custom_resolver;
    const crc = stg.cr_context;
    await this.resolveDoi(doi, cr === true && crc === 'custom', 'newForegroundTab');
  }

  /**
   * Handle tab update reports for context menu match content script
   * @param tabId Tab ID
   * @param changeInfo Tab change info
   * @param tab Tab data
   */
  private contextMenuMatchHandler(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    if (changeInfo.status !== 'complete') {
      return;
    }

    if (
      !/^https?:\/\//i.test(tab.url || '') ||
      /^https:?\/\/chrome\.google\.com\/webstore[/$]/i.test(tab.url || '')
    ) {
      return;
    }

    // Apply context menu match content script
    chrome.tabs.executeScript(tabId, {file: 'context_match.js'}, function (results) {
      if (chrome.runtime.lastError || results === undefined) {
        console.log(`Context menu match listener failed to run on ${tab.url || ''}`);
      }
    });
  }

  /**
   * Enable or disable the listener for context menu match content script
   * @param enable Whether listener should be enabled
   */
  public toggleContextMenuMatchListener(enable: boolean): void {
    if (enable) {
      chrome.tabs.onUpdated.addListener(this.handlers_.contextMenuMatchHandler);
    } else {
      chrome.tabs.onUpdated.removeListener(this.handlers_.contextMenuMatchHandler);
    }
  }

  /**
   * Set context menu match option in storage based on whether permissions
   * are allowed.
   */
  public async setContextMenuMatchOption(): Promise<boolean> {
    this.toggleContextMenuMatchListener(false);
    const result = await checkContentScriptPermissions();
    if (result) {
      await setOptions('local', {context_menu_match: true});
      this.toggleContextMenuMatchListener(true);
      console.log('Context menu match listeners enabled for http and https');
      return true;
    }
    await setOptions('local', {context_menu_match: false});
    return false;
  }

  /**
   * Handle tab removals
   * @param tabId Tab ID
   */
  private tabRemovedHandler(tabId: number): void {
    if (this.openTabs_.length === 0) {
      return;
    }

    const tabIndex = this.openTabs_.indexOf(tabId);
    if (tabIndex >= 0) {
      if (this.openTabs_.length === 1) {
        this.cleanupPermissions().catch((error) => {
          console.error('Error cleaning origin permissions', error);
        });
        this.openTabs_ = [];
      } else {
        this.openTabs_.splice(tabIndex, 1);
      }
    }
  }

  /**
   * Handle runtime messages
   * @param message Internal message
   * @param sender Message sender
   * @param sendResponse Response callback
   */
  private runtimeMessageHandler(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean | void {
    if (!isInternalMessage(message)) {
      return;
    }

    switch (message.cmd) {
      case MessageCmd.AutolinkVars:
        if (isAutolinkVarsMessage(message)) {
          this.sendAutolinkOptions(sendResponse).catch((error) => {
            console.error('Failed to send autolink variables', error);
          });
        }
        break;
      case MessageCmd.ContextMenuToggle:
        if (isContextMenuToggleMessage(message)) {
          this.toggleContextMenu(message.data?.enable, message.data?.doi);
        }
        break;
      default:
        break;
    }

    return true; // Required to allow async sendResponse
  }

  /**
   * Keep track of open tabs
   * @param tabId Tab ID
   */
  public recordTab(tabId: number): void {
    this.openTabs_.push(tabId);
  }

  /**
   * Send autolink option values via internal messaging
   * @param sendResponse Messaging method
   */
  private async sendAutolinkOptions(sendResponse: (response: AutolinkVarsMessage) => void) {
    const stg = await getOptions('local', [
      'cr_autolink',
      'auto_link_rewrite',
      'custom_resolver',
      'doi_resolver',
    ]);

    let doiResolver: string;
    if (stg.custom_resolver && stg.cr_autolink == 'custom' && stg.doi_resolver) {
      doiResolver = stg.doi_resolver;
    } else {
      doiResolver = this.defaultResolver_;
    }
    const rewriteAnchorHref = !!stg.auto_link_rewrite;

    sendResponse({
      cmd: MessageCmd.AutolinkVars,
      data: {doiResolver, rewriteAnchorHref},
    });
  }

  /**
   * Test whether a URL should be excluded from DOI autolinking
   * @param url URL
   * @param autolinkExclusions Exclusion URLs and URL patterns
   * (will be retrieved from storage if undefined)
   */
  public async testAutolinkExclusion(url: string, autolinkExclusions?: string[]): Promise<boolean> {
    const testExclusion = (exclusions: string[]): boolean => {
      if (
        !/^https?:\/\//i.test(url) ||
        /^https:?\/\/chrome\.google\.com\/webstore[/$]/i.test(url)
      ) {
        return true;
      }

      const urlNoProtocol = url.replace(/^https?:\/\//i, '').toLowerCase();
      return exclusions.some((exclusion) => {
        if (exclusion.charAt(0) === '/' && exclusion.slice(-1) === '/') {
          try {
            const re = new RegExp(exclusion.slice(1, -1), 'i');
            return re.test(urlNoProtocol);
          } catch (ex) {
            console.warn('Invalid regular expression', exclusion, ex);
          }
        } else if (urlNoProtocol.startsWith(exclusion.toLowerCase())) {
          return true;
        }
        return false;
      });
    };

    if (autolinkExclusions === undefined) {
      const stg = await getOptions('local', ['autolink_exclusions']);
      autolinkExclusions = stg['autolink_exclusions'] || [];
    }

    return testExclusion(autolinkExclusions);
  }

  /**
   * Handle tab update reports for autolink content script
   * @param tabId Tab ID
   * @param changeInfo Tab change info
   * @param tab Tab data
   */
  private autolinkHandler(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    if (changeInfo.status !== 'complete') {
      return;
    }

    this.autolinkHandlerAsync(tabId, tab).catch((error) => {
      console.error('Failed to handle autolink request', error);
    });
  }

  /**
   * Async handler for tab update reports for autolink content script
   * @param tabId Tab ID
   * @param tab Tab data
   */
  private async autolinkHandlerAsync(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
    const exclude = await this.testAutolinkExclusion(tab.url || '');
    if (exclude) {
      return;
    }

    return new Promise((resolve) => {
      chrome.tabs.executeScript(tabId, {file: 'autolink.js'}, function (results) {
        if (chrome.runtime.lastError || results === undefined) {
          console.log(`Autolink failed to run on ${tab.url || ''}`);
        }
        resolve();
      });
    });
  }

  /**
   * Enable or disable autlink listener
   * @param enable Whether listener should be enabled
   */
  public toggleAutolinkListener(enable: boolean): void {
    if (enable) {
      chrome.tabs.onUpdated.addListener(this.handlers_.autolinkHandler);
    } else {
      chrome.tabs.onUpdated.removeListener(this.handlers_.autolinkHandler);
    }
  }

  /**
   * Set autolink option in storage based on whether permissions
   * are allowed.
   */
  public async setAutolinkOption(): Promise<boolean> {
    this.toggleAutolinkListener(false);
    const result = await checkContentScriptPermissions();
    if (result) {
      await setOptions('local', {auto_link: true});
      this.toggleAutolinkListener(true);
      console.log('Autolink listeners enabled for http and https');
      return true;
    }
    await setOptions('local', {auto_link: false});
    console.log('Autolink listeners disabled');
    return false;
  }

  /**
   * Handle omnibox input entered events
   * @param text Text from omnibox
   * @param disposition Default tab where action should occur
   */
  private omniHandler(text: string, disposition: chrome.omnibox.OnInputEnteredDisposition): void {
    this.omniHandlerAsync(text, disposition).catch((error) =>
      console.error('Failed to handle omnibox input', error)
    );
  }

  /**
   * Async handler for omnibox input entered events
   * @param text Text from omnibox
   * @param disposition Default tab where action should occur
   */
  private async omniHandlerAsync(
    text: string,
    disposition: chrome.omnibox.OnInputEnteredDisposition
  ) {
    const stg = await getOptions('local', ['omnibox_tab', 'custom_resolver', 'cr_omnibox']);

    const doiInput = encodeURI(trimDoi(text)).replace(/^doi:?\s*/i, '');

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

    await this.resolveDoi(doiInput, !!stg.custom_resolver && stg.cr_omnibox === 'custom', tab);
  }
}

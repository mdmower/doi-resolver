/**
 * @license Apache-2.0
 */

import '@popperjs/core';
import 'bootstrap/js/dist/tab';
import 'bootstrap/js/dist/modal';
import 'bootstrap/js/dist/dropdown';
import {
  HistoryDoi,
  StorageOptions,
  clearOptions,
  getDefaultOptions,
  getOptions,
  isCustomResolverSelection,
  isHistorySort,
  isOmniboxTab,
  setOptions,
  isDisplayTheme,
} from './lib/options';
import {MessageCmd, isInternalMessage, isSettingsUpdatedMessage} from './lib/messaging';
import {
  removeContentScriptPermissions,
  requestContentScriptPermissions,
  requestMetaPermissions,
} from './lib/permissions';
import {debounce, isRecord, isValidDoi, sortHistoryEntries} from './lib/utils';
import {testAutolinkExclusion} from './lib/autolink';
import {ContextMenuId, updateContextMenu} from './lib/context_menu';
import {fetchDoiTitles} from './lib/metadata';
import {logError, logInfo, logWarn} from './lib/logger';
import {applyTheme, getMessageNodes} from './utils';
import {recordDois} from './lib/history';

enum UrlHashPage {
  Options = 'tab-options',
  History = 'tab-history',
  About = 'tab-about',
}

interface SaveMapItem {
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  handler: () => void;
  events: (keyof HTMLElementEventMap)[];
}

document.addEventListener(
  'DOMContentLoaded',
  function () {
    new DoiOptions().init().catch((error) => {
      logError('Init failed', error);
    });
  },
  false
);

class DoiOptions {
  private defaultDoiResolver_: string;
  private storageListenerStatus_: boolean;

  private elements_: {
    aboutTab: HTMLButtonElement;
    alExclusions: HTMLDivElement;
    alRewriteLinks: HTMLDivElement;
    autolink: HTMLInputElement;
    autolinkExclusions: HTMLTextAreaElement;
    autolinkRewrite: HTMLInputElement;
    autolinkSubOptions: HTMLDivElement;
    autolinkTestExclusion: HTMLInputElement;
    autolinkTestExclusionResult: HTMLSpanElement;
    context: HTMLInputElement;
    contextMatch: HTMLInputElement;
    contextSubOptions: HTMLDivElement;
    crAutolink: HTMLSelectElement;
    crBubble: HTMLSelectElement;
    crContext: HTMLSelectElement;
    crHistory: HTMLSelectElement;
    crOmnibox: HTMLSelectElement;
    customResolver: HTMLInputElement;
    customResolverSubOptions: HTMLDivElement;
    doiOutputUrlExample: HTMLSpanElement;
    doiResolverInput: HTMLInputElement;
    doiResolverInputReset: HTMLButtonElement;
    doiResolverOutput: HTMLSpanElement;
    history: HTMLInputElement;
    historyClear: HTMLButtonElement;
    historyEntryTemplate: HTMLTemplateElement;
    historyExport: HTMLButtonElement;
    historyFetchTitle: HTMLInputElement;
    historyImportFailure: HTMLAnchorElement;
    historyImportInput: HTMLTextAreaElement;
    historyImportModal: HTMLDivElement;
    historyImportSubmit: HTMLButtonElement;
    historyLength: HTMLInputElement;
    historyNotice: HTMLDivElement;
    historySeparator: HTMLTableRowElement;
    historyShowSave: HTMLInputElement;
    historyShowTitles: HTMLInputElement;
    historySortBy: HTMLSelectElement;
    historySpinner: HTMLSpanElement;
    historySubOptions: HTMLDivElement;
    historyTab: HTMLButtonElement;
    historyTitleRefresh: HTMLButtonElement;
    infoModal: HTMLDivElement;
    meta: HTMLInputElement;
    omniboxOpento: HTMLSelectElement;
    optionsTab: HTMLButtonElement;
    optionsVersion: HTMLParagraphElement;
    shortDoiOutputUrlExample: HTMLSpanElement;
    shortDoiResolverInput: HTMLInputElement;
    shortDoiResolverInputReset: HTMLButtonElement;
    shortDoiResolverOutput: HTMLSpanElement;
    syncData: HTMLInputElement;
    syncDataWipeButton: HTMLButtonElement;
    theme: HTMLSelectElement;
  };

  private handlers_: {
    autolinkOutputTestResults: () => void;
    dbUpdateHistoryLength: () => void;
    dbSaveOptions: () => void;
    deleteHistoryEntry: (event: Event) => void;
    saveOptions: () => void;
    saveHistoryEntry: (event: Event) => void;
    setAutolink: () => void;
    setContextMenu: () => void;
    setContextMenuMatch: () => void;
    setCrPreviews: () => void;
    updateHistoryTitlePermissions: () => void;
  };

  constructor() {
    this.defaultDoiResolver_ = getDefaultOptions()['doi_resolver'];
    this.storageListenerStatus_ = false;

    this.handlers_ = {
      autolinkOutputTestResults: () => {
        this.outputAutolinkExclusionTestResults().catch((error) => {
          logError('Failed to test autolink exclusion', error);
        });
      },
      dbUpdateHistoryLength: debounce(() => {
        this.updateHistoryLength().catch((error) => {
          logError('Failed to update history length', error);
        });
      }, 750),
      dbSaveOptions: debounce(() => {
        this.saveOptions().catch((error) => {
          logError('Failed to save options', error);
        });
      }, 750),
      deleteHistoryEntry: (event: Event) => {
        this.deleteHistoryEntry(event).catch((error) => {
          logError('Failed to save history entry', error);
        });
      },
      saveOptions: () => {
        this.saveOptions().catch((error) => {
          logError('Failed to save options', error);
        });
      },
      saveHistoryEntry: (event: Event) => {
        this.saveHistoryEntry(event).catch((error) => {
          logError('Failed to save history entry', error);
        });
      },
      setAutolink: () => {
        this.setAutolink().catch((error) => {
          logError('Failed to set autolink option', error);
        });
      },
      setContextMenu: () => {
        this.setContextMenu().catch((error) => {
          logError('Failed to set context menu option', error);
        });
      },
      setContextMenuMatch: () => {
        this.setContextMenuMatch().catch((error) => {
          logError('Failed to set context menu match option', error);
        });
      },
      setCrPreviews: this.setCrPreviews.bind(this),
      updateHistoryTitlePermissions: () => {
        this.updateHistoryTitlePermissions().catch((error) => {
          logError('Failed to update history title permissions', error);
        });
      },
    };

    const elementMissing = (selector: string) => {
      throw new Error(`Required element is missing from the page: ${selector}`);
    };
    this.elements_ = {
      aboutTab:
        document.querySelector<HTMLButtonElement>('button#pills-about-tab') ||
        elementMissing('button#pills-about-tab'),
      alExclusions:
        document.querySelector<HTMLDivElement>('div#alExclusions') ||
        elementMissing('div#alExclusions'),
      alRewriteLinks:
        document.querySelector<HTMLDivElement>('div#alRewriteLinks') ||
        elementMissing('div#alRewriteLinks'),
      autolink:
        document.querySelector<HTMLInputElement>('input#autolink') ||
        elementMissing('input#autolink'),
      autolinkExclusions:
        document.querySelector<HTMLTextAreaElement>('textarea#autolinkExclusions') ||
        elementMissing('textarea#autolinkExclusions'),
      autolinkRewrite:
        document.querySelector<HTMLInputElement>('input#autolinkRewrite') ||
        elementMissing('input#autolinkRewrite'),
      autolinkSubOptions:
        document.querySelector<HTMLDivElement>('div#autolinkSubOptions') ||
        elementMissing('div#autolinkSubOptions'),
      autolinkTestExclusion:
        document.querySelector<HTMLInputElement>('input#autolinkTestExclusion') ||
        elementMissing('input#autolinkTestExclusion'),
      autolinkTestExclusionResult:
        document.querySelector<HTMLSpanElement>('span#autolinkTestExclusionResult') ||
        elementMissing('span#autolinkTestExclusionResult'),
      context:
        document.querySelector<HTMLInputElement>('input#context') ||
        elementMissing('input#context'),
      contextMatch:
        document.querySelector<HTMLInputElement>('input#contextMatch') ||
        elementMissing('input#contextMatch'),
      contextSubOptions:
        document.querySelector<HTMLDivElement>('div#contextSubOptions') ||
        elementMissing('div#contextSubOptions'),
      crAutolink:
        document.querySelector<HTMLSelectElement>('select#crAutolink') ||
        elementMissing('select#crAutolink'),
      crBubble:
        document.querySelector<HTMLSelectElement>('select#crBubble') ||
        elementMissing('select#crBubble'),
      crContext:
        document.querySelector<HTMLSelectElement>('select#crContext') ||
        elementMissing('select#crContext'),
      crHistory:
        document.querySelector<HTMLSelectElement>('select#crHistory') ||
        elementMissing('select#crHistory'),
      crOmnibox:
        document.querySelector<HTMLSelectElement>('select#crOmnibox') ||
        elementMissing('select#crOmnibox'),
      customResolver:
        document.querySelector<HTMLInputElement>('input#customResolver') ||
        elementMissing('input#customResolver'),
      customResolverSubOptions:
        document.querySelector<HTMLDivElement>('div#customResolverSubOptions') ||
        elementMissing('div#customResolverSubOptions'),
      doiOutputUrlExample:
        document.querySelector<HTMLSpanElement>('span#doiOutputUrlExample') ||
        elementMissing('span#doiOutputUrlExample'),
      doiResolverInput:
        document.querySelector<HTMLInputElement>('input#doiResolverInput') ||
        elementMissing('input#doiResolverInput'),
      doiResolverInputReset:
        document.querySelector<HTMLButtonElement>('button#doiResolverInputReset') ||
        elementMissing('button#doiResolverInputReset'),
      doiResolverOutput:
        document.querySelector<HTMLSpanElement>('span#doiResolverOutput') ||
        elementMissing('span#doiResolverOutput'),
      history:
        document.querySelector<HTMLInputElement>('input#history') ||
        elementMissing('input#history'),
      historyClear:
        document.querySelector<HTMLButtonElement>('button#historyClear') ||
        elementMissing('button#historyClear'),
      historyEntryTemplate:
        document.querySelector<HTMLTemplateElement>('template#historyEntryTemplate') ||
        elementMissing('template#historyEntryTemplate'),
      historyExport:
        document.querySelector<HTMLButtonElement>('button#historyExport') ||
        elementMissing('button#historyExport'),
      historyFetchTitle:
        document.querySelector<HTMLInputElement>('input#historyFetchTitle') ||
        elementMissing('input#historyFetchTitle'),
      historyImportFailure:
        document.querySelector<HTMLAnchorElement>('a#historyImportFailure') ||
        elementMissing('a#historyImportFailure'),
      historyImportInput:
        document.querySelector<HTMLTextAreaElement>('textarea#historyImportInput') ||
        elementMissing('textarea#historyImportInput'),
      historyImportModal:
        document.querySelector<HTMLDivElement>('div#historyImportModal') ||
        elementMissing('div#historyImportModal'),
      historyImportSubmit:
        document.querySelector<HTMLButtonElement>('button#historyImportSubmit') ||
        elementMissing('button#historyImportSubmit'),
      historyLength:
        document.querySelector<HTMLInputElement>('input#historyLength') ||
        elementMissing('input#historyLength'),
      historyNotice:
        document.querySelector<HTMLDivElement>('div#historyNotice') ||
        elementMissing('div#historyNotice'),
      historySeparator:
        document.querySelector<HTMLTableRowElement>('tr#historySeparator') ||
        elementMissing('tr#historySeparator'),
      historyShowSave:
        document.querySelector<HTMLInputElement>('input#historyShowSave') ||
        elementMissing('input#historyShowSave'),
      historyShowTitles:
        document.querySelector<HTMLInputElement>('input#historyShowTitles') ||
        elementMissing('input#historyShowTitles'),
      historySortBy:
        document.querySelector<HTMLSelectElement>('select#historySortBy') ||
        elementMissing('select#historySortBy'),
      historySpinner:
        document.querySelector<HTMLSpanElement>('span#historySpinner') ||
        elementMissing('span#historySpinner'),
      historySubOptions:
        document.querySelector<HTMLDivElement>('div#historySubOptions') ||
        elementMissing('div#historySubOptions'),
      historyTab:
        document.querySelector<HTMLButtonElement>('button#pills-history-tab') ||
        elementMissing('button#pills-history-tab'),
      historyTitleRefresh:
        document.querySelector<HTMLButtonElement>('button#historyTitleRefresh') ||
        elementMissing('button#historyTitleRefresh'),
      infoModal:
        document.querySelector<HTMLDivElement>('div#infoModal') || elementMissing('div#infoModal'),
      meta: document.querySelector<HTMLInputElement>('input#meta') || elementMissing('input#meta'),
      omniboxOpento:
        document.querySelector<HTMLSelectElement>('select#omniboxOpento') ||
        elementMissing('select#omniboxOpento'),
      optionsTab:
        document.querySelector<HTMLButtonElement>('button#pills-options-tab') ||
        elementMissing('button#pills-options-tab'),
      optionsVersion:
        document.querySelector<HTMLParagraphElement>('p#optionsVersion') ||
        elementMissing('p#optionsVersion'),
      shortDoiOutputUrlExample:
        document.querySelector<HTMLSpanElement>('span#shortDoiOutputUrlExample') ||
        elementMissing('span#shortDoiOutputUrlExample'),
      shortDoiResolverInput:
        document.querySelector<HTMLInputElement>('input#shortDoiResolverInput') ||
        elementMissing('input#shortDoiResolverInput'),
      shortDoiResolverInputReset:
        document.querySelector<HTMLButtonElement>('button#shortDoiResolverInputReset') ||
        elementMissing('button#shortDoiResolverInputReset'),
      shortDoiResolverOutput:
        document.querySelector<HTMLSpanElement>('span#shortDoiResolverOutput') ||
        elementMissing('span#shortDoiResolverOutput'),
      syncData:
        document.querySelector<HTMLInputElement>('input#syncData') ||
        elementMissing('input#syncData'),
      syncDataWipeButton:
        document.querySelector<HTMLButtonElement>('button#syncDataWipeButton') ||
        elementMissing('button#syncDataWipeButton'),
      theme:
        document.querySelector<HTMLSelectElement>('select#theme') || elementMissing('select#theme'),
    };
  }

  /**
   * Initialize options page.
   */
  async init(): Promise<void> {
    this.getLocalMessages();
    this.initWebStoreLink();
    await applyTheme(window);
    this.openTabByHash();
    this.startClickListeners();
    await this.restoreOptions();
    await this.populateHistory();
    this.startRuntimeListeners();
  }

  /**
   * Read #hash from URL and open corresponding tab
   */
  openTabByHash() {
    const hash = location.hash ? location.hash.substring(1) : '';
    if (hash === UrlHashPage.About) {
      this.elements_.aboutTab.click();
    } else if (hash === UrlHashPage.History) {
      this.elements_.historyTab.click();
    } else if (hash === UrlHashPage.Options) {
      // Do nothing
    } else if (location.hash) {
      location.hash = '';
    }
  }

  /**
   * Start listeners for runtime messages
   */
  startRuntimeListeners(): void {
    chrome.runtime.onMessage.addListener(this.runtimeMessageHandler.bind(this));
  }

  /**
   * Start click listeners
   */
  startClickListeners(): void {
    const tabChangeHandler = (event: Event) => {
      const target = event.currentTarget;
      if (target instanceof HTMLButtonElement) {
        location.hash = target.dataset.hash || '';
      }
    };
    this.elements_.aboutTab.addEventListener('show.bs.tab', tabChangeHandler);
    this.elements_.historyTab.addEventListener('show.bs.tab', tabChangeHandler);
    this.elements_.optionsTab.addEventListener('show.bs.tab', tabChangeHandler);

    const defaultDoiResolver = this.defaultDoiResolver_;
    const handleDoiResolverReset = function (this: HTMLInputElement) {
      if (this.value !== defaultDoiResolver) {
        this.value = defaultDoiResolver;
        this.dispatchEvent(new Event('change'));
      }
    };
    this.elements_.doiResolverInputReset.addEventListener(
      'click',
      handleDoiResolverReset.bind(this.elements_.doiResolverInput)
    );
    this.elements_.shortDoiResolverInputReset.addEventListener(
      'click',
      handleDoiResolverReset.bind(this.elements_.shortDoiResolverInput)
    );

    this.elements_.historyTitleRefresh.addEventListener('click', () => {
      this.findMissingHistoryTitles().catch((error) => {
        logError('Failed to handle history titles request', error);
      });
    });
    this.elements_.historyClear.addEventListener('click', () => {
      this.deleteHistory().catch((error) => {
        logError('Failed to delete history', error);
      });
    });

    this.elements_.syncDataWipeButton.addEventListener('click', () => {
      this.elements_.syncData.checked = false;
      clearOptions('sync').catch((error) => {
        logError('Failed to clear sync storage', error);
      });
    });

    this.elements_.historyImportSubmit.addEventListener('click', () => {
      this.importDois().catch((error) => {
        logError('Failed to import DOIs into history', error);
      });
    });

    this.elements_.historyExport.addEventListener('click', () => {
      this.exportDois().catch((error) => {
        logError('Failed to export DOIs', error);
      });
    });

    // Bootstrap types are incomplete. Event types not available.
    const infoModal = this.elements_.infoModal;
    infoModal.addEventListener('show.bs.modal', (event: unknown) => {
      if (!isRecord(event)) {
        return;
      }

      const trigger = event.relatedTarget;
      if (!(trigger instanceof HTMLElement)) {
        return;
      }

      const modalId = trigger.dataset.modalId ?? null;
      this.setInfoModalContents(modalId);
    });

    infoModal.addEventListener('hidden.bs.modal', () => {
      this.setInfoModalContents(null);
    });

    const historyImportModal = this.elements_.historyImportModal;
    historyImportModal.addEventListener('shown.bs.modal', () => {
      this.elements_.historyImportInput.focus();
    });
  }

  /**
   * Handle runtime messages
   * @param message Internal message
   */
  private runtimeMessageHandler(message: unknown): boolean | void {
    if (!isInternalMessage(message)) {
      return;
    }

    switch (message.cmd) {
      case MessageCmd.SettingsUpdated:
        if (isSettingsUpdatedMessage(message) && message.data) {
          this.handleSettingsUpdate(message.data.options, message.data.forceUpdate).catch(
            (error) => {
              logError('Failed to handle settings update', error);
            }
          );
        }
        break;
      default:
        break;
    }
  }

  /**
   * Get a map of elements and their corresponding save handlers and
   * triggering events.
   */
  getSaveMap(): SaveMapItem[] {
    return [
      {
        element: this.elements_.history,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.historyShowSave,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.historyShowTitles,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.historySortBy,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.historyLength,
        handler: this.handlers_.dbUpdateHistoryLength,
        events: ['change'],
      },
      {
        element: this.elements_.historyFetchTitle,
        handler: this.handlers_.updateHistoryTitlePermissions,
        events: ['change'],
      },
      {
        element: this.elements_.context,
        handler: this.handlers_.setContextMenu,
        events: ['change'],
      },
      {
        element: this.elements_.contextMatch,
        handler: this.handlers_.setContextMenuMatch,
        events: ['change'],
      },
      {
        element: this.elements_.meta,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.autolink,
        handler: this.handlers_.setAutolink,
        events: ['change'],
      },
      {
        element: this.elements_.autolinkRewrite,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.customResolver,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.crAutolink,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.crBubble,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.crContext,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.crHistory,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.crOmnibox,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.doiResolverInput,
        handler: this.handlers_.dbSaveOptions,
        events: ['input', 'change'],
      },
      {
        element: this.elements_.doiResolverInput,
        handler: this.handlers_.setCrPreviews,
        events: ['input', 'change'],
      },
      {
        element: this.elements_.shortDoiResolverInput,
        handler: this.handlers_.dbSaveOptions,
        events: ['input', 'change'],
      },
      {
        element: this.elements_.shortDoiResolverInput,
        handler: this.handlers_.setCrPreviews,
        events: ['input', 'change'],
      },
      {
        element: this.elements_.omniboxOpento,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.autolinkExclusions,
        handler: this.handlers_.dbSaveOptions,
        events: ['input', 'change'],
      },
      {
        element: this.elements_.autolinkExclusions,
        handler: this.handlers_.autolinkOutputTestResults,
        events: ['input', 'change'],
      },
      {
        element: this.elements_.autolinkTestExclusion,
        handler: this.handlers_.autolinkOutputTestResults,
        events: ['input', 'change'],
      },
      {
        element: this.elements_.syncData,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
      {
        element: this.elements_.theme,
        handler: this.handlers_.saveOptions,
        events: ['change'],
      },
    ];
  }

  /**
   * Start listening for changes
   */
  startChangeListeners() {
    this.getSaveMap().forEach((mapItem) => {
      mapItem.events.forEach((event) => {
        mapItem.element.addEventListener(event, mapItem.handler);
      });
    });
  }

  /**
   * Stop listening for changes
   */
  haltChangeListeners() {
    this.getSaveMap().forEach((mapItem) => {
      mapItem.events.forEach((event) => {
        mapItem.element.removeEventListener(event, mapItem.handler);
      });
    });
  }

  /**
   * Start listening for history changes
   */
  startHistoryChangeListeners() {
    Array.from(document.getElementsByClassName('historyInputSave')).forEach((element) => {
      element.addEventListener('change', this.handlers_.saveHistoryEntry);
    });
    Array.from(document.getElementsByClassName('historyButtonDelete')).forEach((element) => {
      element.addEventListener('click', this.handlers_.deleteHistoryEntry);
    });
  }

  /**
   * Stop listening for history changes
   */
  haltHistoryChangeListeners() {
    Array.from(document.getElementsByClassName('historyInputSave')).forEach((element) => {
      element.removeEventListener('change', this.handlers_.saveHistoryEntry);
    });
    Array.from(document.getElementsByClassName('historyButtonDelete')).forEach((element) => {
      element.removeEventListener('click', this.handlers_.deleteHistoryEntry);
    });
  }

  /**
   * Save individual options
   * @param options Storage options
   */
  async saveIndividualOptions(options: StorageOptions): Promise<void> {
    this.storageListener(false);
    await setOptions('local', options);
  }

  /**
   * Save all options based on page state
   */
  async saveOptions(): Promise<void> {
    this.optionsDisplayUpdates();

    const options: StorageOptions = {
      auto_link_rewrite: this.elements_.autolinkRewrite.checked,
      history: this.elements_.history.checked,
      history_showsave: this.elements_.historyShowSave.checked,
      history_showtitles: this.elements_.historyShowTitles.checked,
      history_sortby: isHistorySort(this.elements_.historySortBy.value)
        ? this.elements_.historySortBy.value
        : undefined,
      history_length: Number(this.elements_.historyLength.value),
      history_fetch_title: this.elements_.historyFetchTitle.checked,
      context_menu: this.elements_.context.checked,
      meta_buttons: this.elements_.meta.checked,
      custom_resolver: this.elements_.customResolver.checked,
      cr_autolink: isCustomResolverSelection(this.elements_.crAutolink.value)
        ? this.elements_.crAutolink.value
        : undefined,
      cr_bubble: isCustomResolverSelection(this.elements_.crBubble.value)
        ? this.elements_.crBubble.value
        : undefined,
      cr_context: isCustomResolverSelection(this.elements_.crContext.value)
        ? this.elements_.crContext.value
        : undefined,
      cr_history: isCustomResolverSelection(this.elements_.crHistory.value)
        ? this.elements_.crHistory.value
        : undefined,
      cr_omnibox: isCustomResolverSelection(this.elements_.crOmnibox.value)
        ? this.elements_.crOmnibox.value
        : undefined,
      doi_resolver: this.elements_.doiResolverInput.value,
      shortdoi_resolver: this.elements_.shortDoiResolverInput.value,
      omnibox_tab: isOmniboxTab(this.elements_.omniboxOpento.value)
        ? this.elements_.omniboxOpento.value
        : undefined,
      sync_data: this.elements_.syncData.checked,
      theme: isDisplayTheme(this.elements_.theme.value) ? this.elements_.theme.value : undefined,
    };

    // Strip protocol from user-entered autolink exclusions before saving
    options.autolink_exclusions = this.elements_.autolinkExclusions.value
      .split('\n')
      .map((str) => str.replace(/^\s*https?:\/\//i, '').trim())
      .filter(Boolean);

    // If history is disabled, remove all history entries
    if (!options.history) {
      options.recorded_dois = [];
      this.haltHistoryChangeListeners();
      this.removeAllHistoryEntries();
    }

    await this.saveIndividualOptions(options);

    // Restore autolink exclusions if it was modified before saving
    if (this.elements_.autolinkExclusions.value.trim() !== options.autolink_exclusions.join('\n')) {
      this.haltChangeListeners();
      this.elements_.autolinkExclusions.value = options.autolink_exclusions.join('\n');
      this.startChangeListeners();
    }
  }

  /**
   * Restore all options on page from storage
   */
  async restoreOptions(): Promise<void> {
    this.haltChangeListeners();

    const stg = await getOptions('local', [
      'auto_link',
      'auto_link_rewrite',
      'autolink_exclusions',
      'context_menu',
      'context_menu_match',
      'cr_autolink',
      'cr_bubble',
      'cr_context',
      'cr_history',
      'cr_omnibox',
      'custom_resolver',
      'doi_resolver',
      'history',
      'history_fetch_title',
      'history_length',
      'history_showsave',
      'history_showtitles',
      'history_sortby',
      'meta_buttons',
      'omnibox_tab',
      'shortdoi_resolver',
      'sync_data',
      'theme',
    ]);

    const defaultOptions = getDefaultOptions();
    this.elements_.doiResolverInput.value = stg.doi_resolver ?? defaultOptions.doi_resolver;
    this.elements_.shortDoiResolverInput.value =
      stg.shortdoi_resolver ?? defaultOptions.shortdoi_resolver;
    this.elements_.history.checked = stg.history ?? defaultOptions.history;
    this.elements_.historyNotice.hidden = stg.history ?? defaultOptions.history;
    this.elements_.historyShowSave.checked =
      stg.history_showsave ?? defaultOptions.history_showsave;
    this.elements_.historyShowTitles.checked =
      stg.history_showtitles ?? defaultOptions.history_showtitles;
    this.elements_.historySortBy.value = stg.history_sortby ?? defaultOptions.history_sortby;
    this.elements_.historyLength.value = `${stg.history_length ?? defaultOptions.history_length}`;
    this.elements_.historyFetchTitle.checked =
      stg.history_fetch_title ?? defaultOptions.history_fetch_title;
    this.elements_.context.checked = stg.context_menu ?? defaultOptions.context_menu;
    this.elements_.contextMatch.checked =
      stg.context_menu_match ?? defaultOptions.context_menu_match;
    this.elements_.meta.checked = stg.meta_buttons ?? defaultOptions.meta_buttons;
    this.elements_.customResolver.checked = stg.custom_resolver ?? defaultOptions.custom_resolver;
    this.elements_.syncData.checked = stg.sync_data ?? defaultOptions.sync_data;
    this.elements_.crAutolink.value = stg.cr_autolink ?? defaultOptions.cr_autolink;
    this.elements_.crBubble.value = stg.cr_bubble ?? defaultOptions.cr_bubble;
    this.elements_.crContext.value = stg.cr_context ?? defaultOptions.cr_context;
    this.elements_.crHistory.value = stg.cr_history ?? defaultOptions.cr_history;
    this.elements_.crOmnibox.value = stg.cr_omnibox ?? defaultOptions.cr_omnibox;
    this.elements_.omniboxOpento.value = stg.omnibox_tab ?? defaultOptions.omnibox_tab;
    this.elements_.autolink.checked = stg.auto_link ?? defaultOptions.auto_link;
    this.elements_.autolinkRewrite.checked =
      stg.auto_link_rewrite ?? defaultOptions.auto_link_rewrite;
    this.elements_.autolinkExclusions.value = (
      stg.autolink_exclusions ?? defaultOptions.autolink_exclusions
    ).join('\n');
    this.elements_.theme.value = stg.theme ?? defaultOptions.theme;

    this.optionsDisplayUpdates();
    this.startChangeListeners();
    this.storageListener(true);
  }

  /**
   * Update display based on option states
   */
  optionsDisplayUpdates() {
    if (isDisplayTheme(this.elements_.theme.value)) {
      // No need to await here. This can happen async.
      applyTheme(window, this.elements_.theme.value).catch((error) => {
        logError('Failed to refresh theme', error);
      });
    }

    this.elements_.historySubOptions.hidden = !this.elements_.history.checked;
    this.elements_.contextSubOptions.hidden = !this.elements_.context.checked;

    const customResolver = this.elements_.customResolver.checked;
    if (customResolver) {
      this.setCrPreviews();
    }
    this.elements_.customResolverSubOptions.hidden = !customResolver;

    const historyEnabled = this.elements_.history.checked;
    this.elements_.historyNotice.hidden = this.elements_.history.checked;
    this.elements_.historyImportInput.disabled = !historyEnabled;
    this.elements_.historyImportInput.placeholder = historyEnabled
      ? ''
      : chrome.i18n.getMessage('historyNoticeText');
    this.elements_.historyImportSubmit.disabled = !historyEnabled;

    const autolink = this.elements_.autolink.checked;
    this.elements_.autolinkSubOptions.hidden = !autolink;
    const crAutolink = this.elements_.crAutolink.value;
    const showAlRewriteLinks = autolink && customResolver && crAutolink === 'custom';
    this.elements_.alExclusions.hidden = !this.elements_.autolink.checked;
    this.elements_.alRewriteLinks.hidden = !showAlRewriteLinks;
  }

  /**
   * Set a flag indicating the storage listener status
   * @param enable Status of storage listener
   */
  storageListener(enable: boolean) {
    this.storageListenerStatus_ = enable;
  }

  /**
   * Handle settings updated runtime message
   * @param updatedOptions Updated options
   * @param forceUpdate Whether to force a page update
   */
  async handleSettingsUpdate(updatedOptions: StorageOptions, forceUpdate: boolean): Promise<void> {
    if (!this.storageListenerStatus_ && !forceUpdate) {
      this.storageListener(true);
      return;
    }

    // Debugging
    // logInfo('Storage changed, checking for updates');

    if (Object.keys(updatedOptions).length === 0) {
      // Debugging
      // logInfo('Nothing to update');
      return;
    }

    if (updatedOptions.autolink_exclusions !== undefined) {
      await this.outputAutolinkExclusionTestResults();
    }

    const allOptionsInPage: (keyof StorageOptions)[] = [
      'auto_link_rewrite',
      'autolink_exclusions',
      'context_menu',
      'cr_autolink',
      'cr_bubble',
      'cr_context',
      'cr_history',
      'cr_omnibox',
      'custom_resolver',
      'doi_resolver',
      'history',
      'history_fetch_title',
      'history_length',
      'history_showsave',
      'history_showtitles',
      'history_sortby',
      'meta_buttons',
      'omnibox_tab',
      'shortdoi_resolver',
      'sync_data',
      'theme',
    ];

    const historyRefreshOptions: (keyof StorageOptions)[] = [
      'cr_history',
      'custom_resolver',
      'doi_resolver',
      'history_sortby',
      'recorded_dois',
      'shortdoi_resolver',
    ];

    const optionsUpdated = allOptionsInPage.some((option) => updatedOptions[option] !== undefined);
    const historyUpdated = historyRefreshOptions.some(
      (option) => updatedOptions[option] !== undefined
    );

    if (optionsUpdated) {
      logInfo('Options updated');
      await this.restoreOptions();
    }
    if (historyUpdated) {
      logInfo('History updated');
      await this.populateHistory();
    }
    if (!optionsUpdated && !historyUpdated) {
      logInfo('No relevant updates found');
    }

    this.storageListener(true);
  }

  /**
   * Set context menu resolver previews
   */
  setCrPreviews() {
    const drInput = this.elements_.doiResolverInput.value;
    const srInput = this.elements_.shortDoiResolverInput.value;
    let drPreview = '';
    let srPreview = '';

    if (drInput.length <= 10) {
      drPreview = drInput + '10.1000/182';
    } else {
      drPreview = '…' + drInput.slice(-10, drInput.length) + '10.1000/182';
    }
    if (srInput.length <= 10) {
      srPreview = srInput + 'aabbd';
    } else {
      srPreview = '…' + srInput.slice(-10, srInput.length) + 'aabbd';
    }

    this.elements_.doiResolverOutput.textContent = drPreview;
    this.elements_.shortDoiResolverOutput.textContent = srPreview;
  }

  /**
   * Display test result for autolink exclusions
   */
  async outputAutolinkExclusionTestResults(): Promise<void> {
    const autolinkTestExclusionResult = this.elements_.autolinkTestExclusionResult;
    autolinkTestExclusionResult.classList.remove('match', 'nomatch');

    const testUrl = this.elements_.autolinkTestExclusion.value;
    if (!testUrl) {
      autolinkTestExclusionResult.replaceChildren();
      return;
    }
    if (!/https?:\/\//i.test(testUrl)) {
      autolinkTestExclusionResult.replaceChildren(
        ...getMessageNodes('autolinkExclusionsInvalidUrl')
      );
      return;
    }

    const exclusions = this.elements_.autolinkExclusions.value.split('\n').filter(Boolean);
    const matched = await testAutolinkExclusion(testUrl, exclusions);

    if (matched) {
      autolinkTestExclusionResult.replaceChildren(...getMessageNodes('autolinkExclusionsMatch'));
      autolinkTestExclusionResult.classList.add('match');
    } else {
      autolinkTestExclusionResult.replaceChildren(...getMessageNodes('autolinkExclusionsNoMatch'));
      autolinkTestExclusionResult.classList.add('nomatch');
    }
  }

  /**
   * Initiate permissions request/removal to set autolink option.
   */
  // handleSettingsUpdate ignores the auto_link setting in storage, so it's safe
  // to update it without worry of triggering the change handler. The checkbox
  // change handler does need to be disabled, though, as we may end up
  // programmatically setting the check state if permissions are not accepted.
  async setAutolink(): Promise<void> {
    const autolinkElm = this.elements_.autolink;
    this.haltChangeListeners();

    if (autolinkElm.checked) {
      const granted = await requestContentScriptPermissions();
      if (granted) {
        logInfo('Autolink enabled');
        await setOptions('local', {auto_link: true});
        this.optionsDisplayUpdates();
      } else {
        logInfo('Content script permissions not granted');
        await setOptions('local', {auto_link: false});
        autolinkElm.checked = false;
      }
    } else {
      const stg = await getOptions('local', ['context_menu_match']);
      if (stg.context_menu_match) {
        logInfo('Autolink disabled');
        await setOptions('local', {auto_link: false});
        this.optionsDisplayUpdates();
      } else {
        const removed = await removeContentScriptPermissions();
        if (removed) {
          logInfo('Content script permissions removed');
          await setOptions('local', {auto_link: false});
          this.optionsDisplayUpdates();
        } else {
          logInfo('Content script permissions could not be removed');
          logInfo('Autolink disabled');
          await setOptions('local', {auto_link: false});
          this.optionsDisplayUpdates();
        }
      }
    }

    this.startChangeListeners();
  }

  /**
   * Set context menu option
   */
  async setContextMenu(): Promise<void> {
    const contextMenuElm = this.elements_.context;
    if (!contextMenuElm.checked) {
      await setOptions('local', {context_menu_match: false});
      this.haltChangeListeners();
      const contextMatchElm = this.elements_.contextMatch;
      contextMatchElm.checked = false;
      this.startChangeListeners();
    }

    await this.saveOptions();
  }

  /**
   * Initiate permissions request/removal to set context menu match option.
   */
  // handleSettingsUpdate ignores the context_menu_match setting in storage, so
  // it's safe to update it without worry of triggering the change handler. The
  // checkbox change handler does need to be disabled, though, as we may end up
  // programmatically setting the check
  // state if permissions are not accepted.
  async setContextMenuMatch(): Promise<void> {
    const contextMatchElm = this.elements_.contextMatch;
    this.haltChangeListeners();

    if (contextMatchElm.checked) {
      const granted = await requestContentScriptPermissions();
      if (granted) {
        logInfo('Context menu match enabled');
        updateContextMenu(ContextMenuId.ResolveDoi, false);
        await setOptions('local', {context_menu_match: true});
      } else {
        logInfo('Content script permissions not granted');
        await setOptions('local', {context_menu_match: false});
        contextMatchElm.checked = false;
      }
    } else {
      const stg = await getOptions('local', ['auto_link', 'context_menu']);
      if (stg.auto_link) {
        logInfo('Context menu match disabled');
        await setOptions('local', {context_menu_match: false});
        updateContextMenu(ContextMenuId.ResolveDoi, !!stg.context_menu);
      } else {
        const removed = await removeContentScriptPermissions();
        if (removed) {
          logInfo('Content script permissions removed');
          await setOptions('local', {context_menu_match: false});
          updateContextMenu(ContextMenuId.ResolveDoi, !!stg.context_menu);
        } else {
          logInfo('Content script permissions could not be removed');
          logInfo('Context menu match disabled');
          await setOptions('local', {context_menu_match: false});
          updateContextMenu(ContextMenuId.ResolveDoi, !!stg.context_menu);
        }
      }
    }

    this.startChangeListeners();
  }

  /**
   * Get URL for a DOI to use in history display
   * @param doi DOI
   */
  getHistoryUrl(doi: string): string {
    const customResolver = this.elements_.customResolver.checked;
    const crHistory = this.elements_.crHistory.value;
    const useCustomResolver = customResolver && crHistory === 'custom';

    let doiUrl;
    if (useCustomResolver) {
      if (doi.startsWith('10/')) {
        doiUrl = this.elements_.shortDoiResolverInput.value;
        doiUrl += doi.replace(/^10\//, '');
      } else {
        doiUrl = this.elements_.doiResolverInput.value;
        doiUrl += doi;
      }
    } else {
      if (doi.startsWith('10/')) {
        doiUrl = this.defaultDoiResolver_ + doi.replace(/^10\//, '');
      } else {
        doiUrl = this.defaultDoiResolver_ + doi;
      }
    }

    return doiUrl;
  }

  /**
   * Populate the history display
   */
  async populateHistory(): Promise<void> {
    if (!this.elements_.history.checked) {
      return;
    }

    this.haltHistoryChangeListeners();

    const stg = await getOptions('local', ['recorded_dois', 'history_sortby']);
    if (!stg.recorded_dois) {
      return;
    }

    this.removeAllHistoryEntries();

    // Skip holes in the array (should not occur)
    stg.recorded_dois = stg.recorded_dois.filter(Boolean);

    sortHistoryEntries(stg.recorded_dois, stg.history_sortby);

    const historyContainer = this.elements_.historySeparator.parentNode;
    if (historyContainer instanceof HTMLElement) {
      stg.recorded_dois.forEach((recordedDoi) => {
        const historyEntry = this.generateHistoryEntry(recordedDoi);
        if (historyEntry) {
          historyContainer.appendChild(historyEntry);
        }
      });
    }

    this.startHistoryChangeListeners();
  }

  /**
   * Generate a history row
   * @param recordedDoi History record
   */
  generateHistoryEntry(recordedDoi: HistoryDoi): DocumentFragment | null {
    const template = this.elements_.historyEntryTemplate;

    const clone = document.importNode(template.content, true);
    const historyEntry = clone.querySelector<HTMLTableRowElement>('tr.historyEntry');
    const historyInputSave = clone.querySelector<HTMLInputElement>('input.historyInputSave');
    const historyButtonDelete = clone.querySelector<HTMLButtonElement>(
      'button.historyButtonDelete'
    );
    const historyEntryLink = clone.querySelector<HTMLAnchorElement>('a.historyEntryLink');
    const historyEntryTitle = clone.querySelector<HTMLDivElement>('div.historyEntryTitle');

    if (
      !historyEntry ||
      !historyInputSave ||
      !historyButtonDelete ||
      !historyEntryLink ||
      !historyEntryTitle
    ) {
      return null;
    }

    historyEntry.setAttribute('data-doi', recordedDoi.doi);
    historyInputSave.ariaLabel = chrome.i18n.getMessage('tableEntrySaveCheckbox');
    historyInputSave.checked = recordedDoi.save;
    historyButtonDelete.ariaLabel = chrome.i18n.getMessage('tableEntryDeleteButton');
    historyEntryLink.href = this.getHistoryUrl(recordedDoi.doi);
    historyEntryLink.textContent = recordedDoi.doi;
    historyEntryTitle.title = chrome.i18n.getMessage('historyCopyTitle');
    historyEntryTitle.textContent = recordedDoi.title;

    const delta = 6;
    let startX = 0;
    let startY = 0;

    historyEntryTitle.addEventListener('mousedown', function (event) {
      startX = event.pageX;
      startY = event.pageY;
    });

    historyEntryTitle.addEventListener('mouseup', function (event) {
      if (Math.abs(event.pageX - startX) < delta && Math.abs(event.pageY - startY) < delta) {
        if (!navigator.clipboard?.writeText) {
          return;
        }

        navigator.clipboard.writeText(recordedDoi.title).catch((error) => {
          logError('Unable to write to clipboard', error);
        });
      }
    });

    // historyEntryTitle.addEventListener('click', function () {
    //   if (!navigator.clipboard?.writeText) {
    //     return;
    //   }

    //   navigator.clipboard.writeText(recordedDoi.title).catch((error) => {
    //     logError('Unable to write to clipboard', error);
    //   });
    // });

    return clone;
  }

  /**
   * Show/hide the history loading spinner
   * @param enable Whether to show or hide the spinner
   */
  toggleHistorySpinner(enable: boolean): void {
    if (enable) {
      this.elements_.historySpinner.classList.add('show-spinner');
    } else {
      this.elements_.historySpinner.classList.remove('show-spinner');
    }
  }

  /**
   * Look up titles for history DOIs without titles
   */
  async findMissingHistoryTitles(): Promise<void> {
    const granted = await requestMetaPermissions();
    if (!granted) {
      logInfo('Aborting new title retrieval because permissions not granted');
      return;
    }

    const stg = await getOptions('local', ['recorded_dois']);
    if (!stg.recorded_dois) {
      return;
    }

    const dois = stg.recorded_dois.filter((record) => !record.title).map((record) => record.doi);
    if (!dois.length) {
      logInfo('No DOIs are missing titles');
      return;
    }

    logInfo('DOIs queued for title fetch', dois);

    this.toggleHistorySpinner(true);

    const doiTitles = await fetchDoiTitles(dois);
    if (doiTitles) {
      await this.saveHistoryTitles(doiTitles);
    }
    this.toggleHistorySpinner(false);
  }

  /**
   * Update history title permissions
   */
  async updateHistoryTitlePermissions(): Promise<void> {
    const historyFetchTitle = this.elements_.historyFetchTitle;
    if (historyFetchTitle.checked) {
      const granted = await requestMetaPermissions();
      if (granted) {
        await this.saveOptions();
      } else {
        historyFetchTitle.checked = false;
      }
    } else {
      await this.saveOptions();
    }
  }

  /**
   * Save tiles for DOIs in history
   * @param doiTitles DOI-title reference
   */
  async saveHistoryTitles(doiTitles: Record<string, string | undefined>): Promise<void> {
    const dois = Object.keys(doiTitles);
    if (dois.length === 0) {
      return;
    }

    const stg = await getOptions('local', ['recorded_dois']);
    if (!stg.recorded_dois) {
      return;
    }

    let stgUpdated = false;
    for (const doi of dois) {
      const title = doiTitles[doi];
      if (!title) {
        continue;
      }

      const record = stg.recorded_dois.find((item) => item.doi === doi);
      if (record) {
        record.title = title;
        stgUpdated = true;
      }
    }

    if (stgUpdated) {
      await this.saveIndividualOptions(stg);
    }
  }

  /**
   * Handle save history entry
   * @param event Change event
   */
  async saveHistoryEntry(event: Event): Promise<void> {
    const save =
      event.currentTarget instanceof HTMLInputElement ? event.currentTarget.checked : undefined;
    if (save === undefined) {
      return;
    }

    let row = event.currentTarget;
    let doi = '';
    while (row instanceof HTMLElement && !doi) {
      doi = row.getAttribute('data-doi') || '';
      if (doi) {
        break;
      }
      row = row.parentNode;
    }

    if (!doi || !(row instanceof HTMLElement)) {
      return;
    }

    const stg = await getOptions('local', ['recorded_dois']);
    if (!stg.recorded_dois) {
      return;
    }

    const index = stg.recorded_dois.findIndex((item) => item.doi === doi);
    if (index < 0) {
      logError('Unable to save history entry because it is missing from storage');
    }
    stg.recorded_dois[index].save = save;
    await this.saveIndividualOptions(stg);
  }

  /**
   * Handle delete history entry
   * @param event Click event
   */
  async deleteHistoryEntry(event: Event): Promise<void> {
    let row = event.currentTarget;
    let doi = '';
    while (row instanceof HTMLElement && !doi) {
      doi = row.getAttribute('data-doi') || '';
      if (doi) {
        break;
      }
      row = row.parentNode;
    }

    if (!doi || !(row instanceof HTMLElement)) {
      return;
    }

    const stg = await getOptions('local', ['recorded_dois']);
    if (!stg.recorded_dois) {
      return;
    }

    const index = stg.recorded_dois.findIndex((item) => item.doi === doi);
    if (index < 0) {
      logError('Unable to delete history entry because it is missing from storage');
    }
    stg.recorded_dois.splice(index, 1);

    row.classList.add('fadeOut');
    setTimeout(() => {
      this.saveIndividualOptions(stg).catch((error) => {
        logError('Failed to save individual options', error);
      });
    }, 300); // 300ms matches opacity transition in css
  }

  /**
   * Update history entries max length
   */
  async updateHistoryLength(): Promise<void> {
    const historyLength = parseInt(this.elements_.historyLength.value);
    if (isNaN(historyLength)) {
      this.elements_.historyLength.value = getDefaultOptions().history_length.toString();
    } else if (historyLength.toString() !== this.elements_.historyLength.value) {
      this.elements_.historyLength.value = historyLength.toString();
    } else if (historyLength < 1) {
      this.elements_.historyLength.value = '1';
    } else if (historyLength > 5000) {
      this.elements_.historyLength.value = '5000';
    }

    const stg = await getOptions('local', ['recorded_dois']);
    if (!stg.recorded_dois) {
      stg.recorded_dois = [];
    }

    if (historyLength >= stg.recorded_dois.length) {
      await this.saveOptions();
    } else {
      for (let i = 0; i < stg.recorded_dois.length; i++) {
        if (!stg.recorded_dois[i].save) {
          stg.recorded_dois.splice(i--, 1);
        }
        if (historyLength >= stg.recorded_dois.length) {
          break;
        }
      }
      await this.saveIndividualOptions({recorded_dois: stg.recorded_dois});
      await this.saveOptions();
    }
  }

  /**
   * Remove all history entries from display
   */
  removeAllHistoryEntries() {
    const historyEntries = document.getElementsByClassName('historyEntry');
    if (historyEntries.length) {
      const parentNode = historyEntries[0].parentNode;
      if (!parentNode) {
        return;
      }

      while (historyEntries.length) {
        parentNode.removeChild(historyEntries[0]);
      }
    }
  }

  /**
   * Delete DOI history from storage
   */
  async deleteHistory(): Promise<void> {
    const stg = await getOptions('local', ['recorded_dois']);
    const recordedDois = (stg.recorded_dois ?? []).filter((recordedDoi) => recordedDoi.save);
    await this.saveIndividualOptions({recorded_dois: recordedDois});
  }

  /**
   * Record a list of DOIs into history
   */
  async importDois(): Promise<void> {
    const input = this.elements_.historyImportInput.value;
    let dois = input
      .split(/\n|,|;|\|/)
      .map((str) => str.trim())
      .filter((str) => isValidDoi(str));

    if (!dois.length) {
      this.elements_.historyImportInput.value = '';
      return;
    }

    const stg = await getOptions('local', ['history_length', 'recorded_dois']);
    const savedDois = (stg.recorded_dois ?? []).filter((recordDoi) => recordDoi.save).length;
    const maxDois = (stg.history_length ?? getDefaultOptions().history_length) - savedDois;
    if (dois.length > maxDois) {
      dois = dois.slice(-maxDois);
    }

    this.toggleHistorySpinner(true);
    try {
      // Opting to use recordDois directly instead of queueRecordDois since the
      // expectation is that this options page will remain open and we want the
      // spinner to indicate that title fetch is still ongoing (if enabled).
      await recordDois(dois.map((doi) => ({doi, title: '', save: false})));
      this.elements_.historyImportInput.value = '';
    } catch {
      this.elements_.historyImportFailure.click();
    } finally {
      this.toggleHistorySpinner(false);
    }
  }

  /**
   * Export history DOIs to a CSV download
   */
  async exportDois(): Promise<void> {
    const {stringify} = await import('csv-stringify/browser/esm');
    const stg = await getOptions('local', ['recorded_dois']);
    const recordedDois = stg.recorded_dois ?? [];
    const rows: [string, string][] = [
      ['doi', 'title'],
      ...recordedDois.map<[string, string]>(({doi, title}) => [doi, title]),
    ];
    const result = await new Promise<string>((resolve, reject) => {
      stringify(rows, (error, output) => (error ? reject(error) : resolve(output)));
    });

    const file = new File([result], 'dois.csv', {type: 'text/csv'});
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 0);
  }

  /**
   * Set info modal title and body
   * @param modalId Modal ID
   */
  setInfoModalContents(modalId: string | null) {
    const infoModal = this.elements_.infoModal;
    const titleElm = infoModal.querySelector('.modal-title');
    const bodyElm = infoModal.querySelector('.modal-body');
    if (!titleElm || !bodyElm) {
      logWarn('Unable to update modal because elements are missing');
      return;
    }

    const titleChildren: Node[] = [];
    const bodyChildren: Node[] = [];

    if (modalId === 'optionContextMenuModal' || modalId == 'optionMetaButtonsModal') {
      const titleId = `${modalId}Title`;
      titleChildren.push(...getMessageNodes(titleId));

      const bodyId = `${modalId}Body`;
      const description = document.createElement('p');
      description.append(...getMessageNodes(bodyId));
      const imgContainer = document.createElement('div');
      imgContainer.classList.add('text-center');
      const img = document.createElement('img');
      img.classList.add('img-fluid');
      // TODO: Use internationalization to identify locale specific images
      if (modalId === 'optionContextMenuModal') {
        img.src = 'img/context_menu.png';
      } else if (modalId == 'optionMetaButtonsModal') {
        img.src = 'img/bubble_meta.png';
      }
      imgContainer.appendChild(img);
      bodyChildren.push(description, imgContainer);
    } else if (modalId) {
      const titleId = `${modalId}Title`;
      titleChildren.push(...getMessageNodes(titleId));

      const bodyId = `${modalId}Body`;
      bodyChildren.push(...getMessageNodes(bodyId));
    }

    titleElm.replaceChildren(...titleChildren);
    bodyElm.replaceChildren(...bodyChildren);
  }

  /**
   * Get localization strings and populate their corresponding elements' HTML.
   */
  getLocalMessages() {
    document.title = chrome.i18n.getMessage('optionsTitle');

    const pageTitle = document.querySelector('h1.page-title');
    if (pageTitle) {
      pageTitle.textContent = chrome.i18n.getMessage('appName');
    }

    const messageIds = [
      'headingAutolink',
      'headingContextMenu',
      'headingCustomResolver',
      'headingHistory',
      'headingMeta',
      'headingOmnibox',
      'headingSync',
      'headingTheme',
      'historyClear',
      'historyExport',
      'historyFetchTitleLabel',
      'historyImport',
      'historyImportDescription',
      'historyImportModalLabel',
      'historyImportSubmit',
      'historyNoticeText',
      'historySortByDate',
      'historySortByDoi',
      'historySortByLabel',
      'historySortBySave',
      'historySortByTitle',
      'historyTitleRefresh',
      'infoModalLabel',
      'omniboxUsage',
      'optionAutolink',
      'optionAutolinkExclusions',
      'optionAutolinkRewrite',
      'optionAutolinkTestExclusion',
      'optionContextMatch',
      'optionContextMenu',
      'optionCrAutolink',
      'optionCrBubble',
      'optionCrContext',
      'optionCrHistory',
      'optionCrOmnibox',
      'optionCustomResolver',
      'optionCustomResolverSelection',
      'optionHistory',
      'optionHistoryLength',
      'optionHistoryShowSave',
      'optionHistoryShowTitles',
      'optionMetaButtons',
      'optionOmniboxOpento',
      'optionOmniboxOpentoCurtab',
      'optionOmniboxOpentoNewBacktab',
      'optionOmniboxOpentoNewForetab',
      'optionSyncData',
      'optionTheme',
      'optionThemeDark',
      'optionThemeLight',
      'optionThemeSystem',
      'optionsTabAbout',
      'optionsTabHistory',
      'optionsTabSettings',
      'syncDataWipeButton',
      'syncDataWipeDescription',
      'tableHeadingDelete',
      'tableHeadingDoi',
      'tableHeadingSave',
      'textDoiResolverInput',
      'textShortDoiResolverInput',
    ];

    for (const messageId of messageIds) {
      const message = getMessageNodes(messageId);
      const element = document.getElementById(messageId);
      if (message && element) {
        element.append(...message);
      } else if (!message) {
        logInfo(`Unable to insert message ${messageId} because it is not defined.`);
      } else {
        logInfo(`Message for #${messageId} not inserted because element not found.`);
      }
    }

    const ariaLabelMessageIds = [
      'optionContextMenuHelpIcon',
      'optionContextMatchPermissionsIcon',
      'optionMetaButtonsHelpIcon',
      'optionAutolinkPermissionsIcon',
      'optionAutolinkExclusionsHelpIcon',
      'optionSyncDataHelpIcon',
      'tableHeadingSaveHelpIcon',
    ];

    for (const messageId of ariaLabelMessageIds) {
      const message = chrome.i18n.getMessage(messageId);
      const element = document.getElementById(messageId);
      if (message && element) {
        element.ariaLabel = message;
      } else if (!message) {
        logInfo(`Unable to insert message ${messageId} because it is not defined.`);
      } else {
        logInfo(`aria-label for #${messageId} not inserted because element not found.`);
      }
    }

    const messageClasses = ['optionCrCustom', 'optionCrDefault', 'optionCrSelectable'];
    for (const messageClass of messageClasses) {
      for (const element of Array.from(document.getElementsByClassName(messageClass))) {
        element.append(...getMessageNodes(messageClass));
      }
    }

    const closeMessage = chrome.i18n.getMessage('closeButton');
    for (const element of Array.from(
      document.querySelectorAll<HTMLButtonElement>('.modal button.btn-close')
    )) {
      element.ariaLabel = closeMessage;
    }

    this.elements_.doiResolverInputReset.append(...getMessageNodes('resetButton'));
    this.elements_.shortDoiResolverInputReset.append(...getMessageNodes('resetButton'));
    this.elements_.doiOutputUrlExample.append(...getMessageNodes('doiOutputUrlExample'));
    this.elements_.shortDoiOutputUrlExample.append(...getMessageNodes('doiOutputUrlExample'));

    this.elements_.optionsVersion.append(
      ...getMessageNodes('optionsVersion', [chrome.runtime.getManifest().version])
    );
  }

  /**
   * Add link to relevant web store
   */
  private initWebStoreLink(): void {
    const webStoreLink = document.querySelector<HTMLSpanElement>('#webStoreLink');
    if (webStoreLink) {
      let url;
      let text;
      const extensionId = chrome.runtime.id;
      if (extensionId === 'goanbaknlbojfglcepjnankoobfakbpg') {
        url = 'https://chrome.google.com/webstore/detail/quickip/goanbaknlbojfglcepjnankoobfakbpg';
        text = 'Chrome Web Store';
      } else if (extensionId === 'blinbkglegdjgkpblpbgiemkbmkflgah') {
        url =
          'https://microsoftedge.microsoft.com/addons/detail/doi-resolver/blinbkglegdjgkpblpbgiemkbmkflgah';
        text = 'Edge Add-ons';
      } else if (extensionId === '{7befad41-6117-42d0-a803-4fbae41bde5a}') {
        url = `https://addons.mozilla.org/firefox/addon/{7befad41-6117-42d0-a803-4fbae41bde5a}/`;
        text = 'Firefox Add-ons';
      }

      if (url && text) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.textContent = text;
        webStoreLink.textContent = ' / ';
        webStoreLink.appendChild(anchor);
      }
    }
  }
}

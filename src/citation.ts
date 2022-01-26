/**
 * @license Apache-2.0
 */

import './css/citation.scss';
import {HistoryDoi, getDefaultOptions, getOptions, setOptions} from './storage';
import {requestCitationPermissions} from './permissions';
import {filterSelectByText, isObject, isValidDoi, sortHistoryEntries, trimDoi} from './utils';
import {CiteProcSys} from 'citeproc';

interface CitationResources {
  citeProcJson: Record<string, unknown>;
  styleXml: string;
  localeXml: string;
}

interface CslStyles {
  cite_styles: {
    code: string;
    title: string;
    default_locale: string;
  }[];
}

interface CslLocales {
  'primary-dialects': {[key: string]: string | undefined};
  'language-names': {[key: string]: string[] | undefined};
}

interface ReadableLocale {
  locale: string;
  label: string;
}

document.addEventListener(
  'DOMContentLoaded',
  function () {
    new DoiCitation().init().catch((error) => {
      console.error('Init failed', error);
    });
  },
  false
);

class DoiCitation {
  private actions_: {
    queueRecordDoi: (doi: string) => Promise<void>;
    recordTab: (tabId: number) => void;
  };
  private defaultDoiResolver_: string;
  private historyBoxSize_?: number;
  private cslStyles_?: CslStyles;
  private cslLocales_?: CslLocales;
  private elements_: {
    citeDiv: HTMLDivElement;
    citeForm: HTMLFormElement;
    citeLocaleInput: HTMLSelectElement;
    citeStyleFilter: HTMLInputElement;
    closeHistory: SVGElement;
    doiHistory: HTMLSelectElement;
    doiInput: HTMLInputElement;
    inputContainer: HTMLDivElement;
    localSubmitContainer: HTMLDivElement;
    mainForm: HTMLDivElement;
    notifyDiv: HTMLDivElement;
    openHistory: SVGElement;
    styleList: HTMLSelectElement;
  };

  constructor() {
    const doiBackground = chrome.extension.getBackgroundPage()?.doiBackground;
    if (!doiBackground) {
      throw new Error('Could not get background page');
    }
    this.actions_ = {
      queueRecordDoi: doiBackground.queueRecordDoi.bind(doiBackground),
      recordTab: doiBackground.recordTab.bind(doiBackground),
    };
    this.defaultDoiResolver_ = getDefaultOptions()['doi_resolver'];

    const elementMissing = (selector: string) => {
      throw new Error(`Required element is missing from the page: ${selector}`);
    };
    this.elements_ = {
      citeDiv:
        document.querySelector<HTMLDivElement>('div#citeDiv') || elementMissing('div#citeDiv'),
      citeForm:
        document.querySelector<HTMLFormElement>('form#citeForm') || elementMissing('form#citeForm'),
      citeLocaleInput:
        document.querySelector<HTMLSelectElement>('select#citeLocaleInput') ||
        elementMissing('select#citeLocaleInput'),
      citeStyleFilter:
        document.querySelector<HTMLInputElement>('input#citeStyleFilter') ||
        elementMissing('input#citeStyleFilter'),
      closeHistory:
        document.querySelector<SVGElement>('svg#closeHistory') ||
        elementMissing('svg#closeHistory'),
      doiHistory:
        document.querySelector<HTMLSelectElement>('select#doiHistory') ||
        elementMissing('select#doiHistory'),
      doiInput:
        document.querySelector<HTMLInputElement>('input#doiInput') ||
        elementMissing('input#doiInput'),
      inputContainer:
        document.querySelector<HTMLDivElement>('div#inputContainer') ||
        elementMissing('div#inputContainer'),
      localSubmitContainer:
        document.querySelector<HTMLDivElement>('div#localSubmitContainer') ||
        elementMissing('div#localSubmitContainer'),
      mainForm:
        document.querySelector<HTMLDivElement>('div#mainForm') || elementMissing('div#mainForm'),
      notifyDiv:
        document.querySelector<HTMLDivElement>('div#notifyDiv') || elementMissing('div#notifyDiv'),
      openHistory:
        document.querySelector<SVGElement>('svg#openHistory') || elementMissing('svg#openHistory'),
      styleList:
        document.querySelector<HTMLSelectElement>('select#styleList') ||
        elementMissing('select#styleList'),
    };
  }

  /**
   * Initialize citation page.
   */
  public async init(): Promise<void> {
    await this.importCslData();
    this.initializeDoiInput();
    this.getLocalMessages();
    await this.initSelections();
    await this.populateHistory();
    this.startListeners();
  }

  /**
   * Import CSL styles and locales
   */
  private async importCslData(): Promise<void> {
    const {default: cslStyles} = await import('./csl/styles/styles.json');
    this.cslStyles_ = cslStyles;
    const {default: cslLocales} = await import('./csl/locales/locales.json');
    this.cslLocales_ = cslLocales;
  }

  /**
   * Attach window/element listeners.
   */
  private startListeners(): void {
    this.elements_.citeForm.addEventListener('submit', this.formSubmitHandler.bind(this));

    chrome.tabs.getCurrent((tab) => {
      if (tab?.id !== undefined) {
        this.actions_.recordTab(tab.id);
      }
    });
  }

  /**
   * Get DOI from query paramter and insert into <input> element
   */
  private initializeDoiInput(): void {
    const doi = new URL(location.href).searchParams.get('doi');
    this.elements_.doiInput.value = doi || '';
  }

  /**
   * Initialize CSL style and locale <select> elements and filters
   */
  private async initSelections() {
    const stg = await getOptions('local', ['cite_locale', 'cite_style']);

    let storedLocale = stg.cite_locale || getDefaultOptions()['cite_locale'];
    let storedStyle = stg.cite_style || getDefaultOptions()['cite_style'];

    if (!this.cslStyles_ || !this.cslLocales_) {
      throw new Error('CSL styles and locales data not available');
    }

    const languageNames = this.cslLocales_['language-names'];
    const allLocales = Object.keys(languageNames);
    const allStyles = this.cslStyles_.cite_styles;

    if (!allLocales.includes(storedLocale)) {
      storedLocale = 'auto';
      await setOptions('local', {cite_locale: 'auto'});
    }

    // TODO: Offer option to display locales in their native language.
    // Retrieved with: localesMap[allLocales[i]][0]]
    const readableLocales: ReadableLocale[] = allLocales.map((locale) => {
      const labels = languageNames[locale] || [];
      const label = labels[1] || locale;
      return {locale, label};
    });
    readableLocales.sort((a, b) => {
      if (a.label == b.label) {
        return 0;
      }
      return a.label < b.label ? -1 : 1;
    });

    const generateOption = (
      value: string,
      label: string,
      selected: boolean,
      defaultLocale?: string
    ) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = selected;
      if (defaultLocale) {
        option.dataset.locale = defaultLocale;
      }
      return option;
    };

    const citeLocaleInput = this.elements_.citeLocaleInput;
    const localeOption = generateOption('auto', 'Auto', 'auto' === storedLocale);
    citeLocaleInput.appendChild(localeOption);

    readableLocales.forEach((readableLocale) => {
      const {locale, label} = readableLocale;
      const localeOption = generateOption(locale, label, locale === storedLocale);
      citeLocaleInput.appendChild(localeOption);
    });

    const allStyleCodes = Array.from(allStyles, (item) => item.code);

    // Style not found or "other" (migration)
    if (!allStyleCodes.includes(storedStyle)) {
      storedStyle = getDefaultOptions()['cite_style'];
      await setOptions('local', {cite_style: storedStyle});
    }

    const styleList = this.elements_.styleList;
    allStyles.forEach((style) => {
      const {code, title, default_locale} = style;
      const styleOption = generateOption(code, title, code === storedStyle, default_locale);
      styleList.appendChild(styleOption);
    });

    if (styleList.selectedOptions.length) {
      styleList.selectedOptions[0].scrollIntoView();
    }

    this.elements_.citeStyleFilter.addEventListener('input', function () {
      filterSelectByText(styleList, this.value, true);
    });
  }

  /**
   * Handle form submission
   * @param event Submit event
   */
  private formSubmitHandler(event: SubmitEvent): void {
    event.preventDefault();

    const doiInput = encodeURI(trimDoi(this.elements_.doiInput.value));
    if (!isValidDoi(doiInput)) {
      this.simpleNotification(chrome.i18n.getMessage('invalidDoiAlert'));
      return;
    }

    const selectedStyle = this.elements_.styleList.value;
    if (!selectedStyle) {
      this.simpleNotification(chrome.i18n.getMessage('citeStyleNotSelected'));
      return;
    }

    let defaultLocaleForStyle = '';
    const selectedStyleOption = this.elements_.styleList.selectedOptions[0];
    if (selectedStyleOption) {
      defaultLocaleForStyle = selectedStyleOption.dataset.locale || '';
    }

    let selectedLocale = this.elements_.citeLocaleInput.value;
    if (!selectedLocale) {
      selectedLocale = 'auto';
    }

    this.formSubmitHandlerAsync(
      doiInput,
      selectedStyle,
      selectedLocale,
      defaultLocaleForStyle
    ).catch((error) => {
      this.simpleNotification(chrome.i18n.getMessage('noCitationFound'));
      console.error('Failed to handle form submission', error);
    });
  }

  /**
   * Async handler for form submission
   * @param doi DOI
   * @param style CSL style
   * @param locale CSL locale
   * @param defaultLocaleForStyle Default CSL locale for the CSL style
   */
  private async formSubmitHandlerAsync(
    doi: string,
    style: string,
    locale: string,
    defaultLocaleForStyle: string
  ): Promise<void> {
    // Permissions will be cleaned when last QR/Citation tab is closed
    // Note: Citation permissions are sufficient for history title fetch
    // in the background, so no need to also request meta permissions.
    const granted = await requestCitationPermissions();
    if (!granted) {
      this.simpleNotification(chrome.i18n.getMessage('needCitationPerm'));
      return;
    }

    await this.actions_.queueRecordDoi(doi);
    await setOptions('local', {
      cite_style: style,
      cite_locale: locale,
    });

    let forceLocale = true;
    if (locale === 'auto') {
      // Default to en-US in case a defaultLocale is not defined
      locale = defaultLocaleForStyle || 'en-US';
      forceLocale = false;
    }

    const citationResources = await this.getCitationResources(doi, style, locale);
    if (!citationResources) {
      // Message has already been displayed to end user
      return;
    }

    await this.renderCitation(citationResources, locale, forceLocale);
  }

  /**
   * Clear message and citation spaces
   */
  private resetSpace(): void {
    this.elements_.notifyDiv.innerHTML = '';
    this.elements_.notifyDiv.style.display = 'none';
    this.elements_.citeDiv.innerHTML = '';
    this.elements_.citeDiv.style.display = 'none';
  }

  /**
   * Print a notification
   * @param message Message
   */
  private simpleNotification(message: string): void {
    this.resetSpace();
    this.elements_.notifyDiv.innerHTML = message;
    this.elements_.notifyDiv.style.display = 'block';
  }

  /**
   * Output a formatted citation
   * @param citation Formatted citation
   */
  private outputCitation(citation: string): void {
    this.resetSpace();
    this.elements_.citeDiv.innerHTML = citation;
    this.elements_.citeDiv.style.display = 'block';
  }

  /**
   * Fetch a formatted citation
   * @param doi DOI
   * @param style CSL style
   * @param locale CSL locale
   */
  private async getCitationResources(
    doi: string,
    style: string,
    locale: string
  ): Promise<CitationResources | undefined> {
    this.simpleNotification(chrome.i18n.getMessage('loading'));

    const citeProcJsonPromise = this.getCiteProcJson(doi);
    const styleXmlPromise = this.getStyleXml(style);
    const localeXmlPromise = this.getLocaleXml(locale);
    const responses = await Promise.all([citeProcJsonPromise, styleXmlPromise, localeXmlPromise]);
    const [citeProcJson, styleXml, localeXml] = responses;

    if (!citeProcJson) {
      console.error('Invalid CiteProc JSON');
      this.simpleNotification(chrome.i18n.getMessage('noCitationFound'));
      return;
    }

    if (!styleXml) {
      console.error('Invalid style XML');
      this.simpleNotification(
        chrome.i18n.getMessage('citeStyleLoadFailP1') +
          style +
          chrome.i18n.getMessage('citeStyleLoadFailP2')
      );
      return;
    }

    if (!localeXml) {
      console.error('Invalid locale XML');
      this.simpleNotification(
        chrome.i18n.getMessage('citeLocaleLoadFailP1') +
          locale +
          chrome.i18n.getMessage('citeLocaleLoadFailP2')
      );
      return;
    }

    return {citeProcJson, styleXml, localeXml};
  }

  /**
   * Download the CiteProc JSON for the DOI
   * @param doi DOI
   */
  private async getCiteProcJson(doi: string): Promise<Record<string, unknown> | null> {
    const headers = new Headers();
    headers.append('Accept', 'application/vnd.citationstyles.csl+json');

    const request = new Request(this.defaultDoiResolver_ + doi, {
      method: 'GET',
      headers: headers,
    });

    let json: Record<string, unknown> | null = null;
    console.time('Citeproc JSON download');
    try {
      const response = await fetch(request);
      if (!response.ok) {
        throw new Error(`Bad status code: ${response.status}`);
      }
      const unsafeJson: unknown = await response.json();
      if (!isObject(unsafeJson)) {
        throw new Error('Unable to parse response as JSON');
      }
      json = unsafeJson;
    } catch (ex) {
      console.error('Unable to download citation JSON', ex);
    }
    console.timeEnd('Citeproc JSON download');
    return json;
  }

  /**
   * Download the CSL style XML
   * @param style CSL style
   */
  private async getStyleXml(style: string): Promise<string> {
    let text = '';
    console.time('Style XML download');
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/citation-style-language/styles/master/${style}.csl`
      );
      if (!response.ok) {
        throw new Error(`Bad status code: ${response.status}`);
      }
      text = await response.text();
    } catch (ex) {
      console.error('Unable to download style XML', ex);
    }
    console.timeEnd('Style XML download');
    return text;
  }

  /**
   * Download the CSL locale XML
   * @param locale CSL locale
   */
  private async getLocaleXml(locale: string): Promise<string> {
    let text = '';
    console.time('Locale XML download');
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/citation-style-language/locales/master/locales-${locale}.xml`
      );
      if (!response.ok) {
        throw new Error(`Bad status code: ${response.status}`);
      }
      text = await response.text();
    } catch (ex) {
      console.error('Unable to download locale XML', ex);
    }
    console.timeEnd('Locale XML download');
    return text;
  }

  /**
   * Render the citation
   * @param citationResources Downloaded resources to generate citation
   * @param locale CSL locale
   * @param forceLocale Whether to use the provided locale or
   * to determine the appropriate locale automatically
   */
  private async renderCitation(
    citationResources: CitationResources,
    locale: string,
    forceLocale: boolean
  ): Promise<void> {
    const {default: CSL} = await import('citeproc');
    const {citeProcJson, styleXml, localeXml} = citationResources;

    citeProcJson.id = 'Item-1';
    const citations: Record<string, unknown> = {'Item-1': citeProcJson};

    const citeprocSys: CiteProcSys = {
      retrieveLocale: function () {
        return localeXml;
      },
      retrieveItem: function (id: string) {
        return citations[id];
      },
    };

    const citeproc = forceLocale
      ? new CSL.Engine(citeprocSys, styleXml, locale, forceLocale)
      : new CSL.Engine(citeprocSys, styleXml);

    citeproc.updateItems(Object.keys(citations));

    const bibResult = citeproc.makeBibliography();
    if (bibResult) {
      this.outputCitation(bibResult[1].join('\n'));
    } else {
      this.simpleNotification(chrome.i18n.getMessage('citeStyleGenFail'));
    }
  }

  /**
   * Read history entries from storage and populate the <select> box.
   */
  private async populateHistory(): Promise<void> {
    const stg = await getOptions('local', [
      'history',
      'recorded_dois',
      'history_showsave',
      'history_showtitles',
      'history_sortby',
    ]);

    if (!stg.history || !stg.recorded_dois || !stg.recorded_dois.length) {
      this.elements_.openHistory.style.display = 'none';
      return;
    }

    // Skip holes in the array (should not occur)
    stg.recorded_dois = stg.recorded_dois.filter(Boolean);

    sortHistoryEntries(stg.recorded_dois, stg.history_sortby);

    const createOption = (item: HistoryDoi): HTMLOptionElement => {
      const {doi, title, save} = item;
      const element = document.createElement('option');
      element.value = doi;
      element.textContent = stg.history_showtitles && title ? title : doi;
      if (save) {
        element.classList.add('save');
      }
      return element;
    };

    const optionElements: HTMLOptionElement[] = [];
    const savedOptions = stg.recorded_dois.filter((item) => item.save).map(createOption);
    const unsavedOptions = !stg.history_showsave
      ? stg.recorded_dois.filter((item) => !item.save).map(createOption)
      : [];
    const dividerOptions: HTMLOptionElement[] = [];
    if (savedOptions.length && unsavedOptions.length) {
      const dividerOption = document.createElement('option');
      dividerOption.disabled = true;
      dividerOptions.push(dividerOption);
    }
    optionElements.push(...savedOptions, ...dividerOptions, ...unsavedOptions);

    const selectBox = this.elements_.doiHistory;
    selectBox.size = 15;
    selectBox.selectedIndex = -1;
    optionElements.forEach((optionElement) => selectBox.appendChild(optionElement));

    const filterInput = function (this: HTMLInputElement): void {
      filterSelectByText(selectBox, this.value, false);
    };

    const textInput = this.elements_.doiInput;
    textInput.addEventListener('input', filterInput);

    const toggleHistoryBox = this.toggleHistoryBox.bind(this);
    selectBox.addEventListener('change', function () {
      textInput.removeEventListener('input', filterInput);
      textInput.value = this.value;
      textInput.addEventListener('input', filterInput);
      this.selectedIndex = -1;
      filterSelectByText(selectBox, '', false);
      toggleHistoryBox(false);
    });

    this.elements_.openHistory.addEventListener('click', function () {
      toggleHistoryBox(true);
    });

    this.elements_.closeHistory.addEventListener('click', function () {
      toggleHistoryBox(false);
    });

    const mainForm = this.elements_.mainForm;
    document.addEventListener('click', function (event) {
      if (event.target instanceof HTMLElement && !mainForm.contains(event.target)) {
        toggleHistoryBox(false);
      }
    });
  }

  /**
   * Calculate the history box size in px
   */
  private getHistoryBoxSize(): number {
    const inputContainer = this.elements_.inputContainer;
    const localSubmitContainer = this.elements_.localSubmitContainer;
    const boxTop = inputContainer.offsetTop + inputContainer.offsetHeight + 2;
    const boxBottom = localSubmitContainer.offsetTop - 2;
    return boxBottom - boxTop;
  }

  /**
   * Show/hide the history box
   * @param enable Whether history should be shown or not
   */
  private toggleHistoryBox(enable: boolean): void {
    const selectBox = this.elements_.doiHistory;
    if (this.historyBoxSize_ === undefined) {
      this.historyBoxSize_ = this.getHistoryBoxSize();
      selectBox.style.height = `${this.historyBoxSize_}px`;
    }
    const openHistory = this.elements_.openHistory;
    const closeHistory = this.elements_.closeHistory;
    selectBox.style.display = enable ? 'block' : '';
    openHistory.style.display = enable ? 'none' : '';
    closeHistory.style.display = enable ? 'block' : '';
  }

  /**
   * Get localization strings and populate their corresponding elements' HTML.
   */
  private getLocalMessages(): void {
    const message = chrome.i18n.getMessage('citeHeading');
    document.title = message;

    const messageIds = [
      'doiInputLabel',
      'citeHeading',
      'citeLocaleLabel',
      'citeStyleFilterLabel',
      'citeSubHeading',
      'submitButton',
    ];

    messageIds.forEach((messageId) => {
      const message = chrome.i18n.getMessage(messageId);
      const element = document.getElementById(messageId);
      if (element) {
        element.innerHTML = message;
      }
    });
  }
}

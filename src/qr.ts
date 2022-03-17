/**
 * @license Apache-2.0
 */

import './css/qr.scss';
import {
  HistoryDoi,
  QrImageType,
  StorageOptions,
  getDefaultOptions,
  isQrImageType,
  getOptions,
  setOptions,
} from './storage';
import {requestMetaPermissions} from './permissions';
import {
  debounce,
  filterSelectByText,
  isHexColor,
  isValidDoi,
  sortHistoryEntries,
  trimDoi,
} from './utils';
import iro from '@jaames/iro';
import {ColorPickerProps, IroColorPicker} from '@jaames/iro/dist/ColorPicker';
import {isInternalMessage, isSettingsUpdatedMessage, MessageCmd} from './messaging';

interface CreateQrParams {
  size: number;
  border: number;
  fgColor: string;
  bgColor: string | null;
  imgType: QrImageType;
  text: string;
}

enum TitleRetrievalStatus {
  Found,
  Missing,
  Disabled,
}

document.addEventListener(
  'DOMContentLoaded',
  function () {
    new DoiQr().init().catch((error) => {
      console.error('Init failed', error);
    });
  },
  false
);

class DoiQr {
  private actions_: {
    fetchDoiTitle: (doi: string) => Promise<string | undefined>;
    getSavedDoiTitle: (doi: string) => Promise<string | undefined>;
    queueRecordDoi: (doi: string) => Promise<void>;
    recordDoi: (doi: string, title?: string, allowFetch?: boolean) => Promise<void>;
    recordTab: (tabId: number) => void;
  };
  private defaultDoiResolver_: string;
  private historyBoxSize_?: number;
  private savedBgInputColorStyle_?: string;
  private fgColorPicker_?: IroColorPicker;
  private bgColorPicker_?: IroColorPicker;

  private saveOptionsDebounced_: () => void;
  private qrFetchTitleChangeHandler_?: (event: Event) => void;
  private qrManualMessageChangeHandler_?: (event: Event) => void;
  private iroFgColorChangeHandler_?: (color: iro.Color) => void;
  private iroBgColorChangeHandler_?: (color: iro.Color) => void;

  private elements_: {
    closeHistory: SVGElement;
    doiForm: HTMLFormElement;
    doiHistory: HTMLSelectElement;
    doiInput: HTMLInputElement;
    inputContainer: HTMLInputElement;
    mainForm: HTMLDivElement;
    notify_template: HTMLTemplateElement;
    notifyDiv: HTMLDivElement;
    openHistory: SVGElement;
    qrBgColorInput: HTMLInputElement;
    qrBgColorPicker: HTMLDivElement;
    qrBgTrans: HTMLInputElement;
    qrBorderInput: HTMLInputElement;
    qrDiv: HTMLDivElement;
    qrFetchTitle: HTMLInputElement;
    qrFgColorInput: HTMLInputElement;
    qrImageTypePng: HTMLInputElement;
    qrImageTypeSvg: HTMLInputElement;
    qrManualMessage: HTMLInputElement;
    qrManualMessageText: HTMLInputElement;
    qrManualMessageTextDiv: HTMLDivElement;
    qrSizeInput: HTMLInputElement;
    submitButton: HTMLButtonElement;
  };

  constructor() {
    const doiBackground = chrome.extension.getBackgroundPage()?.doiBackground;
    if (!doiBackground) {
      throw new Error('Could not get background page');
    }
    this.actions_ = {
      fetchDoiTitle: doiBackground.fetchDoiTitle.bind(doiBackground),
      getSavedDoiTitle: doiBackground.getSavedDoiTitle.bind(doiBackground),
      queueRecordDoi: doiBackground.queueRecordDoi.bind(doiBackground),
      recordDoi: doiBackground.recordDoi.bind(doiBackground),
      recordTab: doiBackground.recordTab.bind(doiBackground),
    };
    this.defaultDoiResolver_ = getDefaultOptions()['doi_resolver'];
    this.saveOptionsDebounced_ = debounce(this.saveOptions.bind(this), 500);

    const elementMissing = (selector: string) => {
      throw new Error(`Required element is missing from the page: ${selector}`);
    };
    this.elements_ = {
      closeHistory:
        document.querySelector<SVGElement>('svg#closeHistory') ||
        elementMissing('svg#closeHistory'),
      doiForm:
        document.querySelector<HTMLFormElement>('form#doiForm') || elementMissing('form#doiForm'),
      doiHistory:
        document.querySelector<HTMLSelectElement>('select#doiHistory') ||
        elementMissing('select#doiHistory'),
      doiInput:
        document.querySelector<HTMLInputElement>('input#doiInput') ||
        elementMissing('input#doiInput'),
      inputContainer:
        document.querySelector<HTMLInputElement>('div#inputContainer') ||
        elementMissing('div#inputContainer'),
      mainForm:
        document.querySelector<HTMLDivElement>('div#mainForm') || elementMissing('div#mainForm'),
      notify_template:
        document.querySelector<HTMLTemplateElement>('template#notifyTemplate') ||
        elementMissing('template#notifyTemplate'),
      notifyDiv:
        document.querySelector<HTMLDivElement>('div#notifyDiv') || elementMissing('div#notifyDiv'),
      openHistory:
        document.querySelector<SVGElement>('svg#openHistory') || elementMissing('svg#openHistory'),
      qrBgColorInput:
        document.querySelector<HTMLInputElement>('input#qrBgColorInput') ||
        elementMissing('input#qrBgColorInput'),
      qrBgColorPicker:
        document.querySelector<HTMLDivElement>('div#qrBgColorPicker') ||
        elementMissing('div#qrBgColorPicker'),
      qrBgTrans:
        document.querySelector<HTMLInputElement>('input#qrBgTrans') ||
        elementMissing('input#qrBgTrans'),
      qrBorderInput:
        document.querySelector<HTMLInputElement>('input#qrBorderInput') ||
        elementMissing('input#qrBorderInput'),
      qrDiv: document.querySelector<HTMLDivElement>('div#qrDiv') || elementMissing('div#qrDiv'),
      qrFetchTitle:
        document.querySelector<HTMLInputElement>('input#qrFetchTitle') ||
        elementMissing('input#qrFetchTitle'),
      qrFgColorInput:
        document.querySelector<HTMLInputElement>('input#qrFgColorInput') ||
        elementMissing('input#qrFgColorInput'),
      qrImageTypePng:
        document.querySelector<HTMLInputElement>('input#qrImageTypePng') ||
        elementMissing('input#qrImageTypePng'),
      qrImageTypeSvg:
        document.querySelector<HTMLInputElement>('input#qrImageTypeSvg') ||
        elementMissing('input#qrImageTypeSvg'),
      qrManualMessage:
        document.querySelector<HTMLInputElement>('input#qrManualMessage') ||
        elementMissing('input#qrManualMessage'),
      qrManualMessageText:
        document.querySelector<HTMLInputElement>('input#qrManualMessageText') ||
        elementMissing('input#qrManualMessageText'),
      qrManualMessageTextDiv:
        document.querySelector<HTMLDivElement>('div#qrManualMessageTextDiv') ||
        elementMissing('div#qrManualMessageTextDiv'),
      qrSizeInput:
        document.querySelector<HTMLInputElement>('input#qrSizeInput') ||
        elementMissing('input#qrSizeInput'),
      submitButton:
        document.querySelector<HTMLButtonElement>('button#submitButton') ||
        elementMissing('button#submitButton'),
    };
  }

  /**
   * Initialize QR page.
   */
  public async init(): Promise<void> {
    this.getLocalMessages();
    this.initializeDoiInput();
    await this.restoreOptions();
    await this.prepareColorPickers();
    await this.populateHistory();
    this.startListeners();
  }

  /**
   * Attach window/element listeners.
   */
  private startListeners() {
    const saveOptions = this.saveOptions.bind(this);

    this.elements_.doiForm.addEventListener('submit', this.formSubmitHandler.bind(this));
    this.elements_.qrBgTrans.addEventListener('change', this.transparentBgChangeHandler.bind(this));
    this.elements_.qrImageTypePng.addEventListener('click', saveOptions);
    this.elements_.qrImageTypeSvg.addEventListener('click', saveOptions);

    // A debounced version of saveOptions is used inside the saveQrDimensions
    // handler to prevent excessive saves.
    const saveQrDimensions = this.saveQrDimensions.bind(this);
    this.elements_.qrSizeInput.addEventListener('input', saveQrDimensions);
    this.elements_.qrBorderInput.addEventListener('input', saveQrDimensions);
    this.toggleTitleMessageListeners(true);

    // We want the color changes made in the text input to update Iro as soon as
    // possible. A debounced version of saveOptions is used inside the handler to
    // prevent excessive saves.
    const manualColorChangeHandler = this.manualColorChangeHandler.bind(this);
    this.elements_.qrFgColorInput.addEventListener('input', manualColorChangeHandler);
    this.elements_.qrBgColorInput.addEventListener('input', manualColorChangeHandler);

    chrome.tabs.getCurrent((tab) => {
      if (tab?.id !== undefined) {
        this.actions_.recordTab(tab.id);
      }
    });

    const selectBox = this.elements_.doiHistory;
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

    chrome.runtime.onMessage.addListener(this.runtimeMessageHandler.bind(this));
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
          this.handleSettingsUpdate(message.data.options).catch((error) => {
            console.error('Failed to handle settings update', error);
          });
        }
        break;
      default:
        break;
    }

    return true; // Required to allow async sendResponse
  }

  /**
   * Handle settings updated runtime message
   * @param updatedOptions Updated options
   */
  async handleSettingsUpdate(updatedOptions: StorageOptions): Promise<void> {
    console.log('Storage changed, checking for updates');

    if (Object.keys(updatedOptions).length === 0) {
      console.log('Nothing to update');
      return;
    }

    const historyRefreshOptions: (keyof StorageOptions)[] = [
      'cr_history',
      'custom_resolver',
      'doi_resolver',
      'history_sortby',
      'recorded_dois',
      'shortdoi_resolver',
    ];

    const historyUpdated = historyRefreshOptions.some(
      (option) => updatedOptions[option] !== undefined
    );

    if (historyUpdated) {
      console.log('History updated');
      await this.populateHistory();
    } else {
      console.log('No relevant updates found');
    }
  }

  /**
   * Handle transparent background changes
   */
  private transparentBgChangeHandler(): void {
    this.toggleBgColor();
    this.saveOptions();
  }

  /**
   * Toggle element states after transparent background change
   * @param transparent Whether background transparency is enabled
   */
  private toggleBgColor(transparent?: boolean): void {
    if (transparent === undefined) {
      transparent = this.elements_.qrBgTrans.checked;
    }

    const qrBgColorInput = this.elements_.qrBgColorInput;
    qrBgColorInput.disabled = transparent;
    this.elements_.qrBgColorPicker.style.pointerEvents = transparent ? 'none' : 'auto';

    if (transparent) {
      this.savedBgInputColorStyle_ = qrBgColorInput.getAttribute('style') || '';
      qrBgColorInput.removeAttribute('style');
      qrBgColorInput.style.color = 'transparent';
      qrBgColorInput.style.backgroundImage =
        'linear-gradient(45deg, #aaa 25%, transparent 25%), linear-gradient(-45deg, #aaa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #aaa 75%), linear-gradient(-45deg, transparent 75%, #aaa 75%)';
      qrBgColorInput.style.backgroundSize = '20px 20px';
      qrBgColorInput.style.backgroundPosition = '0 0, 0 10px, 10px -10px, -10px 0px';
    } else {
      qrBgColorInput.removeAttribute('style');
      if (this.savedBgInputColorStyle_) {
        qrBgColorInput.setAttribute('style', this.savedBgInputColorStyle_);
      }
    }
  }

  /**
   * Handle color change from manual text input
   * @param event Input event
   */
  private manualColorChangeHandler(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    const inputElement = event.target;
    if (isHexColor(inputElement.value)) {
      inputElement.classList.remove('badColor');
      if (inputElement.id === 'qrFgColorInput' && this.fgColorPicker_) {
        if (this.iroFgColorChangeHandler_) {
          this.fgColorPicker_.off('color:change', this.iroFgColorChangeHandler_);
        }
        this.fgColorPicker_.color.hexString = inputElement.value;
        inputElement.style.background = `linear-gradient(90deg, #fff 50%, ${inputElement.value} 50%)`;
        if (this.iroFgColorChangeHandler_) {
          this.fgColorPicker_.on('color:change', this.iroFgColorChangeHandler_);
        }
      } else if (inputElement.id === 'qrBgColorInput' && this.bgColorPicker_) {
        if (this.iroBgColorChangeHandler_) {
          this.bgColorPicker_.off('color:change', this.iroBgColorChangeHandler_);
        }
        this.bgColorPicker_.color.hexString = inputElement.value;
        inputElement.style.background = `linear-gradient(90deg, #fff 50%, ${inputElement.value} 50%)`;
        if (this.iroBgColorChangeHandler_) {
          this.bgColorPicker_.on('color:change', this.iroBgColorChangeHandler_);
        }
      }
      this.saveOptionsDebounced_();
    } else {
      inputElement.classList.add('badColor');
    }
  }

  /**
   * Handle QR size and border changes
   */
  private saveQrDimensions(): void {
    const qrSizeElm = this.elements_.qrSizeInput;
    let qrSize = Number(qrSizeElm.value);
    if (Number.isNaN(qrSize)) {
      qrSize = 300;
      qrSizeElm.value = `${qrSize}`;
    } else if (qrSize < 80) {
      qrSize = 80;
      qrSizeElm.value = `${qrSize}`;
    }

    const qrBorderElm = this.elements_.qrBorderInput;
    let qrBorder = Number(qrBorderElm.value);
    if (Number.isNaN(qrBorder)) {
      qrBorderElm.value = '0';
      qrBorder = 0;
    } else if (qrSize < 0) {
      qrBorderElm.value = '0';
      qrBorder = 0;
    }

    this.saveOptionsDebounced_();
  }

  /**
   * Get DOI from query paramter and insert into <input> element
   */
  private initializeDoiInput(): void {
    const doi = new URL(location.href).searchParams.get('doi');
    this.elements_.doiInput.value = doi || '';
  }

  /**
   * Restore options from storage
   */
  private async restoreOptions(): Promise<void> {
    const stg = await getOptions('local', [
      'qr_size',
      'qr_border',
      'qr_imgtype',
      'qr_bgtrans',
      'qr_message',
      'qr_title',
    ]);

    if (stg.qr_size === undefined) {
      this.elements_.qrSizeInput.value = '300';
    } else if (stg.qr_size < 80) {
      this.elements_.qrSizeInput.value = '80';
    } else {
      this.elements_.qrSizeInput.value = `${stg.qr_size}`;
    }

    if (stg.qr_border === undefined || stg.qr_border < 0) {
      this.elements_.qrBorderInput.value = '0';
    } else {
      this.elements_.qrBorderInput.value = `${stg.qr_border}`;
    }

    if (stg.qr_imgtype === QrImageType.Png) {
      this.elements_.qrImageTypePng.checked = true;
    } else {
      this.elements_.qrImageTypeSvg.checked = true;
    }

    // If both qr_title and qr_message are true (should not occur),
    // give qr_title precedence
    if (stg.qr_title) {
      this.elements_.qrFetchTitle.checked = true;
      this.elements_.qrManualMessage.disabled = true;
    } else if (stg.qr_message) {
      this.elements_.qrManualMessage.checked = true;
      this.elements_.qrManualMessageTextDiv.style.display = 'flex';
      this.elements_.qrFetchTitle.disabled = true;
    }

    this.elements_.qrBgTrans.checked = !!stg.qr_bgtrans;
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
      element.title = [doi, title].join(' - ');
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
      dividerOption.textContent = chrome.i18n.getMessage('historySaveDivider');
      dividerOptions.push(dividerOption);
    }
    optionElements.push(...savedOptions, ...dividerOptions, ...unsavedOptions);

    const selectBox = this.elements_.doiHistory;
    selectBox.size = 12;
    selectBox.selectedIndex = -1;
    while (selectBox.firstChild) {
      selectBox.removeChild(selectBox.firstChild);
    }
    optionElements.forEach((optionElement) => selectBox.appendChild(optionElement));
  }

  /**
   * Calculate the history box size in px
   */
  private getHistoryBoxSize(): number {
    const inputContainer = this.elements_.inputContainer;
    const boxTop = inputContainer.offsetTop + inputContainer.offsetHeight + 2;
    const submitButton = this.elements_.submitButton;
    const boxBottom = submitButton.offsetTop - 2;
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
   * Prepare Iro color pickers
   */
  private async prepareColorPickers(): Promise<void> {
    const stg = await getOptions('local', ['qr_fgcolor', 'qr_bgcolor', 'qr_bgtrans']);

    let qrFgColor = stg.qr_fgcolor;
    if (!qrFgColor || !isHexColor(qrFgColor)) {
      qrFgColor = '#000000';
      await setOptions('local', {qr_fgcolor: qrFgColor});
    }

    let qrBgColor = stg.qr_bgcolor;
    if (!qrBgColor || !isHexColor(qrBgColor)) {
      qrBgColor = '#ffffff';
      await setOptions('local', {qr_bgcolor: qrBgColor});
    }

    const qrFgColorInput = this.elements_.qrFgColorInput;
    qrFgColorInput.value = qrFgColor;
    qrFgColorInput.style.background = `linear-gradient(90deg, #fff 50%, ${qrFgColor} 50%)`;

    const qrBgColorInput = this.elements_.qrBgColorInput;
    qrBgColorInput.value = qrBgColor;
    qrBgColorInput.style.background = `linear-gradient(90deg, #fff 50%, ${qrBgColor} 50%)`;

    if (stg.qr_bgtrans) {
      this.toggleBgColor(true);
    }

    const colorPickerProps = (color: string): Partial<ColorPickerProps> => ({
      padding: 4,
      sliderMargin: 12,
      width: 180,
      height: 180,
      color,
    });

    const saveOptionsDebounced = this.saveOptionsDebounced_;
    const iroColorChangeHandler = function (this: HTMLInputElement, color: iro.Color): void {
      this.value = color.hexString;
      this.style.background = `linear-gradient(90deg, #fff 50%, ${color.hexString} 50%)`;
      saveOptionsDebounced();
    };

    // TODO: Documentation says to use 'new iro.ColorPicker()':
    // https://iro.js.org/guide.html
    // Test whether omission of 'new' causes problems when there are two pickers:
    // https://github.com/jaames/iro.js/issues/109

    this.fgColorPicker_ = iro.ColorPicker('#qrFgColorPicker', colorPickerProps(qrFgColor));
    this.iroFgColorChangeHandler_ = iroColorChangeHandler.bind(qrFgColorInput);
    this.fgColorPicker_.on('color:change', this.iroFgColorChangeHandler_);

    this.bgColorPicker_ = iro.ColorPicker('#qrBgColorPicker', colorPickerProps(qrBgColor));
    this.iroBgColorChangeHandler_ = iroColorChangeHandler.bind(qrBgColorInput);
    this.bgColorPicker_.on('color:change', this.iroBgColorChangeHandler_);
  }

  /**
   * Async method to save options to storage
   */
  private async saveOptionsAsync(): Promise<void> {
    const options: StorageOptions = {
      qr_bgtrans: this.elements_.qrBgTrans.checked,
      qr_size: Number(this.elements_.qrSizeInput.value),
      qr_border: Number(this.elements_.qrBorderInput.value),
      qr_fgcolor: this.elements_.qrFgColorInput.value,
      qr_bgcolor: this.elements_.qrBgColorInput.value,
      qr_message: this.elements_.qrManualMessage.checked,
      qr_title: this.elements_.qrFetchTitle.checked,
    };

    const checkedQrImageTypeRadio = document.querySelector<HTMLInputElement>(
      'input[name="qrImageType"]:checked'
    );
    if (checkedQrImageTypeRadio) {
      if (isQrImageType(checkedQrImageTypeRadio.value)) {
        options.qr_imgtype = checkedQrImageTypeRadio.value;
      }
    }

    await setOptions('local', options);
  }

  /**
   * Sync method for save options (only meant to be used when waiting for
   * promise to resolve is unnecessary).
   */
  private saveOptions(): void {
    this.saveOptionsAsync().catch((error) => {
      console.error('Failed to save options', error);
    });
  }

  /**
   * Add/Remove fetch/manual title option change listeners
   * @param enable Whether to add or remove change listeners
   */
  private toggleTitleMessageListeners(enable: boolean): void {
    const qrFetchTitle = this.elements_.qrFetchTitle;
    const qrManualMessage = this.elements_.qrManualMessage;

    if (this.qrFetchTitleChangeHandler_ === undefined) {
      this.qrFetchTitleChangeHandler_ = this.titleMessageHandler.bind(this);
    }
    if (this.qrManualMessageChangeHandler_ === undefined) {
      this.qrManualMessageChangeHandler_ = this.titleMessageHandler.bind(this);
    }

    if (enable) {
      qrFetchTitle.addEventListener('change', this.qrFetchTitleChangeHandler_);
      qrManualMessage.addEventListener('change', this.qrManualMessageChangeHandler_);
    } else {
      qrFetchTitle.removeEventListener('change', this.qrFetchTitleChangeHandler_);
      qrManualMessage.removeEventListener('change', this.qrManualMessageChangeHandler_);
    }
  }

  /**
   * Handle fetch/manual title option changes
   * @param event Change event
   */
  private titleMessageHandler(event: Event): void {
    const elementId = event.target instanceof HTMLElement ? event.target.id : undefined;
    this.titleMessageHandlerAsync(elementId).catch((error) => {
      console.error('Failed to handle title message change', error);
    });
  }

  /**
   * Async handler for fetch/manual title option changes
   * @param elementId ID of element that triggered the change
   */
  private async titleMessageHandlerAsync(elementId?: string): Promise<void> {
    this.toggleTitleMessageListeners(false);

    const qrFetchTitle = this.elements_.qrFetchTitle;
    const qrManualMessage = this.elements_.qrManualMessage;
    const qrManualMessageTextDiv = this.elements_.qrManualMessageTextDiv;

    if (elementId === 'qrManualMessage') {
      if (qrManualMessage.checked) {
        qrFetchTitle.checked = false;
        qrFetchTitle.disabled = true;
        qrManualMessageTextDiv.style.display = 'flex';
      } else {
        qrFetchTitle.disabled = false;
        qrManualMessageTextDiv.style.display = '';
      }
      await this.saveOptionsAsync();
    } else {
      // Permissions will be cleaned when last QR/Citation tab is closed
      const granted = !qrFetchTitle.checked || (await requestMetaPermissions());

      if (qrFetchTitle.checked) {
        if (granted) {
          // Permission successfully added
          qrManualMessage.checked = false;
          qrManualMessage.disabled = true;
          qrManualMessageTextDiv.style.display = '';
          await this.saveOptionsAsync();
        } else {
          qrFetchTitle.checked = false;
        }
      } else {
        qrManualMessage.disabled = false;
        await this.saveOptionsAsync();
      }
    }

    this.toggleTitleMessageListeners(true);
  }

  /**
   * Clear message and QR spaces
   */
  private resetSpace(): void {
    this.elements_.notifyDiv.removeAttribute('class');
    this.elements_.notifyDiv.innerHTML = '';
    this.elements_.notifyDiv.style.display = 'none';
    this.elements_.qrDiv.innerHTML = '';
    this.elements_.qrDiv.style.display = 'none';
  }

  /**
   * Print a simple notification
   * @param message Message
   */
  private simpleNotification(message: string): void {
    this.resetSpace();
    this.elements_.notifyDiv.innerHTML = message;
    this.elements_.notifyDiv.style.display = 'block';
  }

  /**
   * Print an advanced notification
   * @param fragment Document fragment
   */
  private advancedNotification(fragment: DocumentFragment): void {
    this.resetSpace();
    this.elements_.notifyDiv.classList.add('advanced');
    this.elements_.notifyDiv.appendChild(fragment);
    this.elements_.notifyDiv.style.display = 'block';
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

    let qrSize = Number(this.elements_.qrSizeInput.value);
    let qrBorder = Number(this.elements_.qrBorderInput.value);
    const fgColor = this.elements_.qrFgColorInput.value;
    const bgColor = this.elements_.qrBgTrans.checked ? null : this.elements_.qrBgColorInput.value;
    const qrImageTypeValue = document.querySelector<HTMLInputElement>(
      'input[name="qrImageType"]:checked'
    )?.value;
    const qrImageType = isQrImageType(qrImageTypeValue) ? qrImageTypeValue : QrImageType.Png;

    if (Number.isNaN(qrSize)) {
      qrSize = 300;
      this.elements_.qrSizeInput.value = `${qrSize}`;
    } else if (qrSize < 80) {
      qrSize = 80;
      this.elements_.qrSizeInput.value = `${qrSize}`;
    }

    if (Number.isNaN(qrBorder) || qrBorder < 0) {
      qrBorder = 0;
      this.elements_.qrBorderInput.value = `${qrBorder}`;
    }

    const qrParms: CreateQrParams = {
      size: qrSize,
      border: qrBorder,
      fgColor,
      bgColor,
      imgType: qrImageType,
      text: '',
    };

    this.insertQr(doiInput, qrParms).catch((error) => {
      //TODO: this.simpleNotification(chrome.i18n.getMessage('xxxxxxxx'));
      console.error('Failed to insert QR', error);
    });
  }

  /**
   * Handle title retrieval, generate a QR image, linkify it,
   * and finally insert it into the page.
   * @param doi DOI
   * @param qrParms QR image creation parameters
   */
  private async insertQr(doi: string, qrParms: CreateQrParams): Promise<void> {
    this.resetSpace();

    let messageToEncode = this.defaultDoiResolver_;
    if (/^10\//.test(doi)) {
      messageToEncode += doi.replace(/^10\//, '');
    } else {
      messageToEncode += doi;
    }

    this.simpleNotification('Loading...');

    if (this.elements_.qrFetchTitle.checked) {
      const title = await this.actions_.getSavedDoiTitle(doi);

      if (title) {
        console.log('Found title in history');
        messageToEncode = title + '\n' + messageToEncode;
        this.updateMessage(messageToEncode, TitleRetrievalStatus.Found);
        qrParms.text = messageToEncode;
        await this.createQrImage(qrParms);
        return;
      }

      // Permissions will be cleaned when last QR/Citation tab is closed
      const granted = await requestMetaPermissions();

      if (granted) {
        console.log('Fetching title from network');
        const title = await this.actions_.fetchDoiTitle(doi);

        if (title) {
          messageToEncode = title + '\n' + messageToEncode;
          this.updateMessage(messageToEncode, TitleRetrievalStatus.Found);
        } else {
          this.updateMessage(messageToEncode, TitleRetrievalStatus.Missing);
        }
        qrParms.text = messageToEncode;
        await this.createQrImage(qrParms);

        try {
          await this.actions_.recordDoi(doi, title);
        } catch (ex) {
          console.error('Unable to record DOI', ex);
        }
      } else {
        console.log('Permissions not granted for title fetch');
        this.updateMessage(messageToEncode, TitleRetrievalStatus.Disabled);
        qrParms.text = messageToEncode;
        await this.createQrImage(qrParms);

        try {
          await this.actions_.recordDoi(doi, undefined, false);
        } catch (ex) {
          console.error('Unable to record DOI', ex);
        }
      }
    } else {
      if (this.elements_.qrManualMessage.checked) {
        const titleString = this.elements_.qrManualMessageText.value;
        if (titleString) {
          messageToEncode = titleString + '\n' + messageToEncode;
        }
      }
      this.updateMessage(messageToEncode, TitleRetrievalStatus.Disabled);
      qrParms.text = messageToEncode;
      await this.createQrImage(qrParms);

      const stg = await getOptions('local', ['history', 'history_fetch_title']);
      if (stg.history && stg.history_fetch_title) {
        await requestMetaPermissions();
      }
      await this.actions_.queueRecordDoi(doi);
    }
  }

  /**
   * Transform a qrcodegen QrCode object into an <svg> element
   * @param qr qrcodegen QrCode object
   * @param qrParams QR image creation parameters
   */
  private toSvg(
    qr: import('./qrcodegen/qrcodegen').qrcodegen.QrCode,
    qrParams: CreateQrParams
  ): SVGElement {
    const border = qrParams.border;
    const viewBox = qr.size + border * 2;

    const parts: string[] = [];
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.getModule(x, y)) parts.push(`M${x + border},${y + border}h1v1h-1z`);
      }
    }

    const ns = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('version', '1.1');
    svg.setAttribute('viewBox', `0 0 ${viewBox} ${viewBox}`);
    svg.setAttribute('stroke', 'none');
    svg.setAttribute('width', `${qrParams.size}`);
    svg.setAttribute('height', `${qrParams.size}`);

    // Background
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    if (qrParams.bgColor === null) {
      rect.setAttribute('fill', '#ffffff');
      rect.setAttribute('fill-opacity', '0.0');
    } else {
      rect.setAttribute('fill', qrParams.bgColor);
    }

    // Foreground
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', qrParams.fgColor);
    path.setAttribute('d', parts.join(' '));

    svg.appendChild(rect);
    svg.appendChild(path);
    return svg;
  }

  /**
   * Create QR image and insert into page
   * @param qrParms QR image creation parameters
   */
  private async createQrImage(qrParms: CreateQrParams): Promise<void> {
    const {QrCode} = (await import('./qrcodegen/qrcodegen')).qrcodegen;
    const ecl = QrCode.Ecc.MEDIUM;
    const qr = QrCode.encodeText(qrParms.text, ecl);
    const svg = this.toSvg(qr, qrParms);
    const linkifyQrImage = this.linkifyQrImage.bind(this);

    const svgDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.outerHTML);
    if (qrParms.imgType === QrImageType.Png) {
      const canvas = document.createElement('canvas');
      canvas.width = qrParms.size;
      canvas.height = qrParms.size;
      this.elements_.qrDiv.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = function () {
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          linkifyQrImage(qrParms.imgType, canvas.toDataURL('image/png'));
        }
      };
      img.src = svgDataUrl;
    } else {
      this.elements_.qrDiv.appendChild(svg);
      linkifyQrImage(qrParms.imgType, svgDataUrl);
    }
  }

  /**
   * Update the encoded message output
   * @param message Encoded message
   * @param titleRetrieval Status of title retrieval
   */
  private updateMessage(message: string, titleRetrieval: TitleRetrievalStatus): void {
    let titleNotice = '';

    switch (titleRetrieval) {
      case TitleRetrievalStatus.Found:
        titleNotice = chrome.i18n.getMessage('qrTitleSuccess');
        break;
      case TitleRetrievalStatus.Missing:
        titleNotice = chrome.i18n.getMessage('qrTitleFailure');
        break;
      case TitleRetrievalStatus.Disabled:
      default:
        titleNotice = chrome.i18n.getMessage('qrDisabled');
        break;
    }

    const template = this.elements_.notify_template;

    const clone = document.importNode(template.content, true);
    const headings = clone.querySelectorAll('.notifyHeading');
    const contents = clone.querySelectorAll('.notifyContent');

    headings[0].innerHTML = chrome.i18n.getMessage('qrTitleStatus');
    contents[0].innerHTML = titleNotice;
    headings[1].innerHTML = chrome.i18n.getMessage('qrMessageEncoded');
    contents[1].innerHTML = message;

    this.advancedNotification(clone);
  }

  /**
   * Wrap QR image with a download anchor
   * @param imgType Image type
   * @param dataUrl Base64 data URL
   */
  private linkifyQrImage(imgType: QrImageType, dataUrl: string): void {
    const qrDiv = this.elements_.qrDiv;
    const qrImg = qrDiv.firstChild;
    if (qrImg === null) {
      return;
    }

    const saveLink = document.createElement('a');
    saveLink.id = 'qrImageSaveLink';
    saveLink.href = dataUrl;
    const filename = imgType === QrImageType.Png ? 'qrImage.png' : 'qrImage.svg';
    saveLink.download = filename;

    saveLink.appendChild(qrImg);
    qrDiv.appendChild(saveLink);

    this.elements_.qrDiv.style.display = 'block';
  }

  /**
   * Get localization strings and populate their corresponding elements' HTML.
   */
  private getLocalMessages(): void {
    const message = chrome.i18n.getMessage('qrHeading');
    document.title = message;

    const messageIds = [
      'doiInputLabel',
      'qrBgColorInputLabel',
      'qrBgTransLabel',
      'qrFetchTitleLabel',
      'qrFgColorInputLabel',
      'qrHeading',
      'qrManualMessageLabel',
      'qrManualMessageTextLabel',
      'qrSizeInputLabel',
      'qrBorderInputLabel',
      'qrImageTypeLabel',
      'qrSubHeading',
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

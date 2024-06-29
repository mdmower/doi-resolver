/**
 * @license Apache-2.0
 */

import {getTypedKeys, isRecord, isString} from './utils';

/**
 * Get the values of multiple stored options
 * @param area Storage area
 * @param options Option names
 */
export async function getOptions(
  area: chrome.storage.AreaName,
  options?: (keyof StorageOptions)[]
): Promise<StorageOptions> {
  const items = await chrome.storage[area].get(options || null);
  return toStorageOptions(items);
}

/**
 * Set the value of multiple options in storage
 * @param area Storage area
 * @param options Option name/value pairs
 */
export async function setOptions(
  area: chrome.storage.AreaName,
  options: StorageOptions
): Promise<void> {
  await chrome.storage[area].set(options);
}

/**
 * Remove multiple options from storage
 * @param area Storage area
 * @param optionNames Option names
 */
export async function removeOptions(
  area: chrome.storage.AreaName,
  optionNames: string[]
): Promise<void> {
  await chrome.storage[area].remove(optionNames);
}

/**
 * Clear options from storage
 * @param area Storage area
 */
export async function clearOptions(area: chrome.storage.AreaName): Promise<void> {
  await chrome.storage[area].clear();
}

export interface HistoryDoi {
  doi: string;
  title: string;
  save: boolean;
}

export enum HistorySort {
  Doi = 'doi',
  Title = 'title',
  Save = 'save',
  Date = 'date',
}

export enum CustomResolverSelection {
  Default = 'default',
  Custom = 'custom',
  Selectable = 'selectable',
}

export enum QrImageType {
  Svg = 'svg',
  Png = 'png',
}

export enum OmniboxTab {
  NewForegroundTab = 'newfgtab',
  NewBackgroundTab = 'newbgtab',
  CurrentTab = 'curtab',
}

export enum DisplayTheme {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

export interface StorageOptions {
  auto_link?: boolean;
  auto_link_rewrite?: boolean;
  autolink_exclusions?: string[];
  cite_locale?: string;
  cite_style?: string;
  context_menu?: boolean;
  context_menu_match?: boolean;
  cr_autolink?: CustomResolverSelection;
  cr_bubble?: CustomResolverSelection;
  cr_bubble_last?: CustomResolverSelection;
  cr_context?: CustomResolverSelection;
  cr_history?: CustomResolverSelection;
  cr_omnibox?: CustomResolverSelection;
  custom_resolver?: boolean;
  doi_resolver?: string;
  history?: boolean;
  history_doi_queue?: string[];
  history_fetch_title?: boolean;
  history_length?: number;
  history_showsave?: boolean;
  history_showtitles?: boolean;
  history_sortby?: HistorySort;
  meta_buttons?: boolean;
  omnibox_tab?: OmniboxTab;
  qr_bgcolor?: string;
  qr_bgtrans?: boolean;
  qr_border?: number;
  qr_fgcolor?: string;
  qr_imgtype?: QrImageType;
  qr_message?: boolean;
  qr_size?: number;
  qr_title?: boolean;
  recorded_dois?: HistoryDoi[];
  shortdoi_resolver?: string;
  sync_data?: boolean;
  theme?: DisplayTheme;
}

/**
 * Verify an item is an instance of CustomResolverSelection
 * @param val Unverified item
 */
export function isCustomResolverSelection(val: unknown): val is CustomResolverSelection {
  return typeof val === 'string' && Object.values<string>(CustomResolverSelection).includes(val);
}

/**
 * Verify an item is an instance of HistorySort
 * @param val Unverified item
 */
export function isHistorySort(val: unknown): val is HistorySort {
  return typeof val === 'string' && Object.values<string>(HistorySort).includes(val);
}

/**
 * Verify an item is an instance of QrImageType
 * @param val Unverified item
 */
export function isQrImageType(val: unknown): val is QrImageType {
  return typeof val === 'string' && Object.values<string>(QrImageType).includes(val);
}

/**
 * Verify an item is an instance of OmniboxTab
 * @param val Unverified item
 */
export function isOmniboxTab(val: unknown): val is OmniboxTab {
  return typeof val === 'string' && Object.values<string>(OmniboxTab).includes(val);
}

/**
 * Verify an object is an instance of HistoryDoi
 * @param val Unverified object
 */
export function isHistoryDoi(val: unknown): val is HistoryDoi {
  return (
    isRecord(val) &&
    typeof val['doi'] === 'string' &&
    typeof val['title'] === 'string' &&
    typeof val['save'] === 'boolean'
  );
}

/**
 * Verify an item is an instance of DisplayTheme
 * @param val Unverified item
 */
export function isDisplayTheme(val: unknown): val is DisplayTheme {
  return typeof val === 'string' && Object.values<string>(DisplayTheme).includes(val);
}

/**
 * Safely cast an object to StorageOptions
 * @param obj Unsafe object
 */
export function toStorageOptions(obj: unknown): StorageOptions {
  const storageOptions: StorageOptions = {};

  if (!isRecord(obj)) {
    return storageOptions;
  }

  const {
    auto_link,
    auto_link_rewrite,
    autolink_exclusions,
    cite_locale,
    cite_style,
    context_menu,
    context_menu_match,
    cr_autolink,
    cr_bubble,
    cr_bubble_last,
    cr_context,
    cr_history,
    cr_omnibox,
    custom_resolver,
    doi_resolver,
    history,
    history_doi_queue,
    history_fetch_title,
    history_length,
    history_showsave,
    history_showtitles,
    history_sortby,
    meta_buttons,
    omnibox_tab,
    qr_bgcolor,
    qr_bgtrans,
    qr_border,
    qr_fgcolor,
    qr_imgtype,
    qr_message,
    qr_size,
    qr_title,
    recorded_dois,
    shortdoi_resolver,
    sync_data,
    theme,
  } = obj;

  if (typeof auto_link === 'boolean') {
    storageOptions.auto_link = auto_link;
  }
  if (typeof auto_link_rewrite === 'boolean') {
    storageOptions.auto_link_rewrite = auto_link_rewrite;
  }
  if (Array.isArray(autolink_exclusions)) {
    storageOptions.autolink_exclusions = autolink_exclusions.filter(isString);
  }
  if (typeof cite_locale === 'string') {
    storageOptions.cite_locale = cite_locale;
  }
  if (typeof cite_style === 'string') {
    storageOptions.cite_style = cite_style;
  }
  if (typeof context_menu === 'boolean') {
    storageOptions.context_menu = context_menu;
  }
  if (typeof context_menu_match === 'boolean') {
    storageOptions.context_menu_match = context_menu_match;
  }
  if (isCustomResolverSelection(cr_autolink)) {
    storageOptions.cr_autolink = cr_autolink;
  }
  if (isCustomResolverSelection(cr_bubble)) {
    storageOptions.cr_bubble = cr_bubble;
  }
  if (isCustomResolverSelection(cr_bubble_last)) {
    storageOptions.cr_bubble_last = cr_bubble_last;
  }
  if (isCustomResolverSelection(cr_context)) {
    storageOptions.cr_context = cr_context;
  }
  if (isCustomResolverSelection(cr_history)) {
    storageOptions.cr_history = cr_history;
  }
  if (isCustomResolverSelection(cr_omnibox)) {
    storageOptions.cr_omnibox = cr_omnibox;
  }
  if (typeof custom_resolver === 'boolean') {
    storageOptions.custom_resolver = custom_resolver;
  }
  if (typeof doi_resolver === 'string') {
    storageOptions.doi_resolver = doi_resolver;
  }
  if (typeof history === 'boolean') {
    storageOptions.history = history;
  }
  if (Array.isArray(history_doi_queue)) {
    storageOptions.history_doi_queue = history_doi_queue.filter(isString);
  }
  if (typeof history_fetch_title === 'boolean') {
    storageOptions.history_fetch_title = history_fetch_title;
  }
  if (typeof history_length === 'number') {
    storageOptions.history_length = history_length;
  }
  if (typeof history_showsave === 'boolean') {
    storageOptions.history_showsave = history_showsave;
  }
  if (typeof history_showtitles === 'boolean') {
    storageOptions.history_showtitles = history_showtitles;
  }
  if (isHistorySort(history_sortby)) {
    storageOptions.history_sortby = history_sortby;
  }
  if (typeof meta_buttons === 'boolean') {
    storageOptions.meta_buttons = meta_buttons;
  }
  if (isOmniboxTab(omnibox_tab)) {
    storageOptions.omnibox_tab = omnibox_tab;
  }
  if (typeof qr_bgcolor === 'string') {
    storageOptions.qr_bgcolor = qr_bgcolor;
  }
  if (typeof qr_bgtrans === 'boolean') {
    storageOptions.qr_bgtrans = qr_bgtrans;
  }
  if (typeof qr_border === 'number') {
    storageOptions.qr_border = qr_border;
  }
  if (typeof qr_fgcolor === 'string') {
    storageOptions.qr_fgcolor = qr_fgcolor;
  }
  if (isQrImageType(qr_imgtype)) {
    storageOptions.qr_imgtype = qr_imgtype;
  }
  if (typeof qr_message === 'boolean') {
    storageOptions.qr_message = qr_message;
  }
  if (typeof qr_size === 'number') {
    storageOptions.qr_size = qr_size;
  }
  if (typeof qr_title === 'boolean') {
    storageOptions.qr_title = qr_title;
  }
  if (Array.isArray(recorded_dois)) {
    storageOptions.recorded_dois = recorded_dois.filter(isHistoryDoi);
  }
  if (typeof shortdoi_resolver === 'string') {
    storageOptions.shortdoi_resolver = shortdoi_resolver;
  }
  if (typeof sync_data === 'boolean') {
    storageOptions.sync_data = sync_data;
  }
  if (isDisplayTheme(theme)) {
    storageOptions.theme = theme;
  }

  return storageOptions;
}

/**
 * Verify an object is an instance of StorageOptions
 * @param obj Unverified object
 */
export function isStorageOptions(obj: unknown): obj is StorageOptions {
  if (!isRecord(obj)) {
    return false;
  }

  const {
    auto_link,
    auto_link_rewrite,
    autolink_exclusions,
    cite_locale,
    cite_style,
    context_menu,
    context_menu_match,
    cr_autolink,
    cr_bubble,
    cr_bubble_last,
    cr_context,
    cr_history,
    cr_omnibox,
    custom_resolver,
    doi_resolver,
    history,
    history_doi_queue,
    history_fetch_title,
    history_length,
    history_showsave,
    history_showtitles,
    history_sortby,
    meta_buttons,
    omnibox_tab,
    qr_bgcolor,
    qr_bgtrans,
    qr_border,
    qr_fgcolor,
    qr_imgtype,
    qr_message,
    qr_size,
    qr_title,
    recorded_dois,
    shortdoi_resolver,
    sync_data,
    theme,
  } = obj;

  if (auto_link !== undefined && typeof auto_link !== 'boolean') {
    return false;
  }
  if (auto_link_rewrite !== undefined && typeof auto_link_rewrite !== 'boolean') {
    return false;
  }
  if (
    autolink_exclusions !== undefined &&
    !(Array.isArray(autolink_exclusions) && autolink_exclusions.every(isString))
  ) {
    return false;
  }
  if (cite_locale !== undefined && typeof obj['cite_locale'] !== 'string') {
    return false;
  }
  if (cite_style !== undefined && typeof cite_style !== 'string') {
    return false;
  }
  if (context_menu !== undefined && typeof context_menu !== 'boolean') {
    return false;
  }
  if (context_menu_match !== undefined && typeof context_menu_match !== 'boolean') {
    return false;
  }
  if (cr_autolink !== undefined && !isCustomResolverSelection(cr_autolink)) {
    return false;
  }
  if (cr_bubble !== undefined && !isCustomResolverSelection(cr_bubble)) {
    return false;
  }
  if (cr_bubble_last !== undefined && !isCustomResolverSelection(cr_bubble_last)) {
    return false;
  }
  if (cr_context !== undefined && !isCustomResolverSelection(cr_context)) {
    return false;
  }
  if (cr_history !== undefined && !isCustomResolverSelection(cr_history)) {
    return false;
  }
  if (cr_omnibox !== undefined && !isCustomResolverSelection(cr_omnibox)) {
    return false;
  }
  if (custom_resolver !== undefined && typeof custom_resolver !== 'boolean') {
    return false;
  }
  if (doi_resolver !== undefined && typeof doi_resolver !== 'string') {
    return false;
  }
  if (history !== undefined && typeof history !== 'boolean') {
    return false;
  }
  if (
    history_doi_queue !== undefined &&
    !(Array.isArray(history_doi_queue) && history_doi_queue.every(isString))
  ) {
    return false;
  }
  if (history_fetch_title !== undefined && typeof history_fetch_title !== 'boolean') {
    return false;
  }
  if (history_length !== undefined && typeof history_length !== 'number') {
    return false;
  }
  if (history_showsave !== undefined && typeof history_showsave !== 'boolean') {
    return false;
  }
  if (history_showtitles !== undefined && typeof history_showtitles !== 'boolean') {
    return false;
  }
  if (history_sortby !== undefined && !isHistorySort(history_sortby)) {
    return false;
  }
  if (meta_buttons !== undefined && typeof meta_buttons !== 'boolean') {
    return false;
  }
  if (omnibox_tab !== undefined && !isOmniboxTab(omnibox_tab)) {
    return false;
  }
  if (qr_bgcolor !== undefined && typeof qr_bgcolor !== 'string') {
    return false;
  }
  if (qr_bgtrans !== undefined && typeof qr_bgtrans !== 'boolean') {
    return false;
  }
  if (qr_border !== undefined && typeof qr_border !== 'number') {
    return false;
  }
  if (qr_fgcolor !== undefined && typeof qr_fgcolor !== 'string') {
    return false;
  }
  if (qr_imgtype !== undefined && !isQrImageType(qr_imgtype)) {
    return false;
  }
  if (qr_message !== undefined && typeof qr_message !== 'boolean') {
    return false;
  }
  if (qr_size !== undefined && typeof qr_size !== 'number') {
    return false;
  }
  if (qr_title !== undefined && typeof qr_title !== 'boolean') {
    return false;
  }
  if (
    recorded_dois !== undefined &&
    !(Array.isArray(recorded_dois) && recorded_dois.every(isHistoryDoi))
  ) {
    return false;
  }
  if (shortdoi_resolver !== undefined && typeof shortdoi_resolver !== 'string') {
    return false;
  }
  if (sync_data !== undefined && typeof sync_data !== 'boolean') {
    return false;
  }
  if (theme !== undefined && !isDisplayTheme(theme)) {
    return false;
  }

  return true;
}

/**
 * Get all options with their default values
 */
export function getDefaultOptions(): Required<StorageOptions> {
  return {
    auto_link: false,
    auto_link_rewrite: false,
    autolink_exclusions: [],
    cite_locale: 'auto',
    cite_style: 'bibtex',
    context_menu: true,
    context_menu_match: false,
    cr_autolink: CustomResolverSelection.Custom,
    cr_bubble: CustomResolverSelection.Custom,
    cr_bubble_last: CustomResolverSelection.Custom,
    cr_context: CustomResolverSelection.Custom,
    cr_history: CustomResolverSelection.Custom,
    cr_omnibox: CustomResolverSelection.Custom,
    custom_resolver: false,
    doi_resolver: 'https://doi.org/',
    history: false,
    history_doi_queue: [],
    history_fetch_title: false,
    history_length: 50,
    history_showsave: false,
    history_showtitles: false,
    history_sortby: HistorySort.Date,
    meta_buttons: true,
    omnibox_tab: OmniboxTab.NewForegroundTab,
    qr_bgcolor: '#ffffff',
    qr_bgtrans: false,
    qr_border: 0,
    qr_fgcolor: '#000000',
    qr_imgtype: QrImageType.Png,
    qr_message: false,
    qr_size: 300,
    qr_title: false,
    recorded_dois: [],
    shortdoi_resolver: 'https://doi.org/',
    sync_data: false,
    theme: DisplayTheme.System,
  };
}

/**
 * Get all option names
 */
export function getAllOptionNames(): (keyof StorageOptions)[] {
  return getTypedKeys(getDefaultOptions());
}

/**
 * Get option names that should be excluded from sync
 */
export function getSyncExclusionNames(): (keyof StorageOptions)[] {
  return [
    'auto_link', // Requires permissions to enable
    'context_menu_match', // Requires permissions to enable
    'history_doi_queue', // Queue for recordDoi
    'history_fetch_title', // Requires permissions to enable
    'qr_title', // Requires permissions to enable
    'sync_data', // Controls sync on/off
  ];
}

/**
 * Get option names that have been deprecated
 */
export function getDeprecatedOptionNames(): string[] {
  return [
    'storage_listener_disabled', // Indicated whether storage change listener should be temporarily disabled
    'sync_reset', // Indicated whether sync settings should be cleared and sync disabled
  ];
}

/**
 * Get all option names that are allowed to sync
 */
export function getAllSyncOptionNames(): (keyof StorageOptions)[] {
  const syncExclusionNames = getSyncExclusionNames();
  return getAllOptionNames().filter((name) => !syncExclusionNames.includes(name));
}

/**
 * Get all option names that require a forced refresh of the options page when updated
 */
export function getForceRefreshOptionNames(): (keyof StorageOptions)[] {
  return [
    'cr_history',
    'custom_resolver',
    'doi_resolver',
    'history_sortby',
    'recorded_dois',
    'shortdoi_resolver',
  ];
}

import {Page, Worker} from '@playwright/test';
import {
  CustomResolverSelection,
  DisplayTheme,
  HistorySort,
  OmniboxTab,
  QrImageType,
  StorageOptions,
} from '../src/lib/options';

export const handbookDoi = '10.1000/182';
export const handbookShortDoi = '10/aabbd';

export const extensionPages = [
  'bubble',
  'citation',
  'notification',
  'offscreen',
  'options',
  'qr',
] as const;
export type ExtensionPage = (typeof extensionPages)[number];

export const optionLabels: Record<
  Exclude<
    keyof StorageOptions,
    'cite_style' | 'cr_bubble_last' | 'history_doi_queue' | 'qr_imgtype' | 'recorded_dois'
  >,
  string
> = {
  auto_link: 'Automatically turn DOI codes on web pages into links',
  auto_link_rewrite: 'Rewrite existing doi.org and dx.doi.org links to use the Custom DOI Resolver',
  autolink_exclusions: 'Exclude URLs and URL patterns from autolink',
  cite_locale: 'Locale',
  // cite_style
  context_menu: 'Enable right-click context menu for selected text',
  context_menu_match: 'Only show context menu entry if a DOI is selected',
  cr_autolink: 'Autolink',
  cr_bubble: 'Popup',
  // cr_bubble_last
  cr_context: 'Context Menu',
  cr_history: 'History',
  cr_omnibox: 'Omnibox',
  custom_resolver: 'Use a custom DOI resolver',
  doi_resolver: 'URL for DOI resolver',
  history: 'Retain history of DOIs',
  // history_doi_queue
  history_fetch_title: 'Automatically fetch title when a new DOI is recorded',
  history_length: 'Number of history entries to retain (1 ≤ N ≤ 5000)',
  history_showsave: 'Only show saved entries in text input box drop-downs',
  history_showtitles: 'Show titles instead of DOIs in text input box drop-downs',
  history_sortby: 'Sort by',
  meta_buttons: 'Enable additional features in the browser action bubble',
  omnibox_tab: 'Omnibox entry should by default open result in:',
  qr_bgcolor: 'Background color',
  qr_bgtrans: 'Transparent background',
  qr_border: 'Border',
  qr_fgcolor: 'Foreground color',
  // qr_imgtype
  qr_message: 'Include message in QR code',
  qr_size: 'Size',
  qr_title: 'Include title of reference in QR code',
  // recorded_dois
  shortdoi_resolver: 'URL for ShortDOI resolver',
  sync_data: "Synchronize this extension's settings with your profile",
  theme: 'Color theme for pages',
};

export function getStorageValue(handler: Page | Worker, key: string): Promise<unknown> {
  return handler.evaluate(async (key) => {
    const stg = await chrome.storage.local.get(key);
    return stg[key] as unknown;
  }, key);
}

export function getCustomizedOptions(): Required<StorageOptions> {
  return {
    auto_link: true,
    auto_link_rewrite: true,
    autolink_exclusions: ['example.com/abc', '/example\\.com/def'],
    cite_locale: 'en-US',
    cite_style: 'american-physics-society',
    context_menu: true, // Same as default
    context_menu_match: true,
    cr_autolink: CustomResolverSelection.Default,
    cr_bubble: CustomResolverSelection.Default,
    cr_bubble_last: CustomResolverSelection.Default,
    cr_context: CustomResolverSelection.Default,
    cr_history: CustomResolverSelection.Default,
    cr_omnibox: CustomResolverSelection.Default,
    custom_resolver: true,
    doi_resolver: 'https://dx.doi.org/',
    history: true,
    history_doi_queue: [], // Same as default
    history_fetch_title: true,
    history_length: 100,
    history_showsave: true,
    history_showtitles: true,
    history_sortby: HistorySort.Title,
    meta_buttons: false,
    omnibox_tab: OmniboxTab.CurrentTab,
    qr_bgcolor: '#ddeeb5',
    qr_bgtrans: true,
    qr_border: 1,
    qr_fgcolor: '#00193d',
    qr_imgtype: QrImageType.Svg,
    qr_message: false, // Same as default
    qr_size: 500,
    qr_title: true,
    recorded_dois: [
      {doi: '10.1000/1', save: true, title: 'DOI Home'},
      {doi: '10.1000/182', save: true, title: 'DOI Handbook'},
    ],
    shortdoi_resolver: 'https://dx.doi.org/',
    sync_data: false, // Same as default
    theme: DisplayTheme.Dark,
  };
}

import {Page} from '@playwright/test';

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

export function getStorageValue(page: Page, key: string): Promise<unknown> {
  return page.evaluate(async (key) => {
    const stg = await chrome.storage.local.get(key);
    return stg[key] as unknown;
  }, key);
}

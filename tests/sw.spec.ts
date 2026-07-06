import {test, expect} from './fixtures';
import {getDefaultOptions} from '../src/lib/options';

test.describe('Service Worker', () => {
  test('set default options on install', async ({serviceWorker}) => {
    await expect
      .poll(() => serviceWorker.evaluate(() => chrome.storage.local.get()))
      .toEqual(getDefaultOptions());
  });
});

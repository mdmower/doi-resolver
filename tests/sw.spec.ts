import {test, expect} from './fixtures';
import {getDefaultOptions} from '../src/lib/options';

test.describe('Service Worker', () => {
  test('set default options on install', async ({serviceWorker}) => {
    const stg = await serviceWorker.evaluate(() => chrome.storage.local.get());
    expect(stg).toEqual(getDefaultOptions());
  });
});

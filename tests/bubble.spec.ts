import {test, expect} from './fixtures';
import {DisplayTheme, getDefaultOptions} from '../src/lib/options';

test.describe('Bubble', () => {
  test.beforeEach(async ({page, serviceWorker}) => {
    const bubbleUrl = await serviceWorker.evaluate(
      async ({defaultOptions}) => {
        await chrome.storage.local.clear();
        await chrome.storage.local.set(defaultOptions);
        return chrome.runtime.getURL('bubble.html');
      },
      {defaultOptions: getDefaultOptions()}
    );
    await page.goto(bubbleUrl);
  });

  test('display theme', async ({page}) => {
    const htmlThemes: string[] = [DisplayTheme.Dark, DisplayTheme.Light];
    for (const theme of Object.values(DisplayTheme)) {
      await page.evaluate((s) => chrome.storage.local.set(s), {theme});
      await page.reload({waitUntil: 'load'});
      const htmlTheme = await page.locator('html').evaluate((html) => html.dataset.bsTheme);
      expect(
        theme === DisplayTheme.System ? htmlThemes.includes(htmlTheme ?? '') : htmlTheme === theme
      ).toBe(true);
    }
  });

  test('navigation to DOI', async ({page, context}) => {
    await page.getByPlaceholder('DOI').fill('10.1000/182');
    const closeBubblePromise = page.waitForEvent('close');
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    await closeBubblePromise;
    const newPage = await newPagePromise;
    await expect(newPage).toHaveURL('https://www.doi.org/the-identifier/resources/handbook/');
  });
});

import {test, expect} from './fixtures';
import {DisplayTheme} from '../src/lib/options';

test.describe('Notification', () => {
  const title = 'C0mplic@ted titlé?';
  const message = 'This "content & stuff"™ should not fail — not even 1% of the time!® Right?';

  test.beforeEach(async ({page, extension}) => {
    const search = '?' + new URLSearchParams({title, message}).toString();
    await page.goto(extension.urls.notification + search);
  });

  test('use display theme', async ({page}) => {
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

  test('content display', async ({page}) => {
    await page.reload({waitUntil: 'load'});
    await expect(page.getByRole('heading', {name: title})).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });
});

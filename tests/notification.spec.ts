import {test, expect} from './fixtures';
import {DisplayTheme} from '../src/lib/options';
import {getPageBsTheme} from './utils';

test.describe('Notification', () => {
  const title = 'C0mplic@ted titlé?';
  const message = 'This "content & stuff"™ should not fail — not even 1% of the time!® Right?';

  test.beforeEach(async ({page, extension}) => {
    const search = '?' + new URLSearchParams({title, message}).toString();
    await page.goto(extension.urls.notification + search);
  });

  test('use display theme', async ({page}) => {
    for (const theme of Object.values(DisplayTheme)) {
      await page.evaluate((s) => chrome.storage.local.set(s), {theme});
      await page.reload({waitUntil: 'load'});
      await expect
        .poll(async () => {
          const pageTheme = await getPageBsTheme(page);
          return theme === DisplayTheme.System ? !!pageTheme : pageTheme === theme;
        })
        .toBe(true);
    }
  });

  test('content display', async ({page}) => {
    await page.reload({waitUntil: 'load'});
    await expect(page.getByRole('heading', {name: title})).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });
});

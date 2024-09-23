import {test, expect} from './fixtures';

test.describe('Autolink', () => {
  const url = 'https://doi.org/10.1000/182';

  test('DOI autolink', async ({page, serviceWorker}) => {
    await serviceWorker.evaluate((s) => chrome.storage.local.set(s), {auto_link: true});
    await page.goto(url);
    await expect(page.getByRole('heading', {name: 'DOI Handbook'})).toBeVisible();
    await expect(page.getByText('DOI https://doi.org/10.1000/182 identifies')).toBeVisible();
    await expect(page.getByRole('link', {name: '10.1000/182'})).toHaveAttribute('href', url);
  });

  test('DOI autolink normal exclusion', async ({page, serviceWorker}) => {
    await serviceWorker.evaluate((s) => chrome.storage.local.set(s), {
      auto_link: true,
      autolink_exclusions: ['www.doi.org'],
    });
    await page.goto(url);
    await expect(page.getByText('DOI https://doi.org/10.1000/182 identifies')).toBeVisible();
    await expect(page.getByRole('link', {name: '10.1000/182'})).toHaveCount(0);
  });

  test('DOI autolink regex exclusion', async ({page, serviceWorker}) => {
    await serviceWorker.evaluate((s) => chrome.storage.local.set(s), {
      auto_link: true,
      autolink_exclusions: ['/www\\.doi\\.org/.*/'],
    });
    await page.goto(url);
    await expect(page.getByText('DOI https://doi.org/10.1000/182 identifies')).toBeVisible();
    await expect(page.getByRole('link', {name: '10.1000/182'})).toHaveCount(0);
  });

  test('DOI autolink with custom resolver', async ({page, serviceWorker}) => {
    await serviceWorker.evaluate((s) => chrome.storage.local.set(s), {
      auto_link: true,
      custom_resolver: true,
      cr_autolink: 'custom',
      doi_resolver: 'https://example.com/',
    });
    await page.goto(url);
    await expect(page.getByRole('link', {name: '10.1000/182'})).toHaveAttribute(
      'href',
      'https://example.com/10.1000/182'
    );
  });
});

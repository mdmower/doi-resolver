import {test, expect} from './fixtures';
import {DisplayTheme, HistoryDoi, HistorySort} from '../src/lib/options';
import {getStorageValue} from './utils';

test.describe('Citation', () => {
  const doi = '10.1045/january99-bearman';
  const title = 'A Common Model to Support Interoperable Metadata';

  test.beforeEach(async ({page, extension}) => {
    const search = '?' + new URLSearchParams({doi}).toString();
    await page.goto(extension.urls.citation + search);
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

  test('field initialization', async ({page}) => {
    await expect(page.getByLabel('DOI')).toHaveValue(doi);
    await expect(page.getByLabel('Filter styles')).toHaveValue('');
    await expect(page.locator('#styleList')).toHaveValue('bibtex');
    await expect(page.getByLabel('Locale')).toHaveValue('auto');
  });

  test('default citation retrieval', async ({page}) => {
    await page.getByRole('button', {name: 'Submit'}).click();
    await expect(
      page.getByText('title={A Common Model to Support Interoperable Metadata}')
    ).toBeVisible();
  });

  test('ShortDOI citation retrieval', async ({page}) => {
    await page.getByLabel('DOI').fill('10/cg7cd4');
    await page.getByRole('button', {name: 'Submit'}).click();
    await expect(
      page.getByText('title={A Common Model to Support Interoperable Metadata}')
    ).toBeVisible();
  });

  test('invalid DOI', async ({page}) => {
    await page.getByLabel('DOI').clear();
    await page.getByRole('button', {name: 'Submit'}).click();
    await expect(page.getByText('Not a valid DOI')).toBeVisible();
    await page.getByLabel('DOI').fill('abc');
    await page.getByRole('button', {name: 'Submit'}).click();
    await expect(page.getByText('Not a valid DOI')).toBeVisible();
  });

  test('style filter', async ({page}) => {
    await expect(page.locator('#styleList')).toHaveValue('bibtex');
    await page.getByLabel('Filter styles').fill('bibtex');
    await expect(page.locator('#styleList')).toHaveValue('bibtex');
    await page.getByLabel('Filter styles').fill('physical');
    await expect(page.locator('#styleList')).not.toHaveValue(/^(bibtex)?$/);
    await expect(page.locator('#styleList option[value="bibtex"]')).toBeHidden();
    await page.locator('#styleList').selectOption('American Physical Society');
    await expect(page.locator('#styleList')).toHaveValue('american-physics-society');
    await page.getByLabel('Filter styles').clear();
    await expect(page.locator('#styleList option[value="bibtex"]')).toBeVisible();
  });

  test('citation retrieval with APS style', async ({page}) => {
    await expect(page.getByLabel('DOI')).toHaveValue(doi);
    await page.locator('#styleList').selectOption('American Physical Society');
    await page.getByRole('button', {name: 'Submit'}).click();
    await expect.poll(() => getStorageValue(page, 'cite_style')).toBe('american-physics-society');
    await expect(
      page.getByText('D. Bearman, E. Miller, G. Rust, J. Trant, and S. Weibel')
    ).toBeVisible();
  });

  test('citation retrieval with APS style and German locale', async ({page}) => {
    await expect(page.getByLabel('DOI')).toHaveValue(doi);
    await page.locator('#styleList').selectOption('American Physical Society');
    await page.getByLabel('Locale').selectOption('German (Germany)');
    await page.getByRole('button', {name: 'Submit'}).click();
    await expect.poll(() => getStorageValue(page, 'cite_style')).toBe('american-physics-society');
    await expect.poll(() => getStorageValue(page, 'cite_locale')).toBe('de-DE');
    await expect(
      page.getByText('D. Bearman, E. Miller, G. Rust, J. Trant, und S. Weibel')
    ).toBeVisible();
  });

  test.describe('History', () => {
    test('record DOI on citation retrieval', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {history: true});
      await page.getByRole('button', {name: 'Submit'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi, title: '', save: false}]);
    });

    test('record ShortDOI on citation retrieval', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {history: true});
      await page.getByLabel('DOI').fill('10/cg7cd4');
      await page.getByRole('button', {name: 'Submit'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi: '10/cg7cd4', title: '', save: false}]);
    });

    test('record DOI with title on citation retrieval', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_fetch_title: true,
      });
      await page.getByRole('button', {name: 'Submit'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi, title, save: false}]);
    });

    test('record ShortDOI with title on citation retrieval', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_fetch_title: true,
      });
      await page.getByLabel('DOI').fill('10/cg7cd4');
      await page.getByRole('button', {name: 'Submit'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi: '10/cg7cd4', title, save: false}]);
    });

    test('only show history button when history available', async ({page}) => {
      await expect(page.getByRole('link', {name: 'History'})).toBeHidden();
      await page.evaluate((s) => chrome.storage.local.set(s), {history: true});
      await page.reload({waitUntil: 'load'});
      await expect(page.getByRole('link', {name: 'History'})).toBeHidden();
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        recorded_dois: [{doi: '10.1000/1', title: '', save: false}] as HistoryDoi[],
      });
      await expect(page.getByRole('link', {name: 'History'})).toBeVisible();
    });

    test('history modal', async ({page}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        recorded_dois: [{doi: '10.1000/1', title: '', save: false}] as HistoryDoi[],
      });
      await page.reload({waitUntil: 'load'});
      const modalTrigger = page.getByRole('link', {name: 'History'});
      await modalTrigger.click();
      const modal = page.locator('#historyModal');
      await expect(modal).toBeVisible();
      await expect(modal.locator('.modal-title')).toHaveText('History');
      await modal.getByLabel('Close').click();
      await expect(modal).toBeHidden();
    });

    test('show DOIs in history modal', async ({page}) => {
      const recorded_dois: HistoryDoi[] = [
        {doi: '10.1000/1', title: '', save: false},
        {doi: '10.1000/2', title: '', save: true},
        {doi: '10/3', title: '', save: false},
      ];
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        recorded_dois,
      });
      await page.reload({waitUntil: 'load'});

      await page.getByRole('link', {name: 'History'}).click();
      const modal = page.locator('#historyModal');
      await expect(modal).toBeVisible();

      const expected = [
        {text: '10.1000/2', divider: false},
        {text: '↑ Saved / Unsaved ↓', divider: true},
        {text: '10/3', divider: false},
        {text: '10.1000/1', divider: false},
      ];
      for (let i = 0; i < expected.length; i++) {
        await expect(modal.getByRole('option').nth(i)).toHaveText(expected[i].text);
        await expect(modal.getByRole('option').nth(i)).toBeEnabled({enabled: !expected[i].divider});
      }
    });

    test('show DOI titles in history modal', async ({page}) => {
      const recorded_dois: HistoryDoi[] = [
        {doi: '10.1000/1', title: 'Some title 1', save: false},
        {doi: '10.1000/2', title: 'Another title 2', save: true},
        {doi: '10/3', title: '3. Title', save: false},
      ];
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_showtitles: true,
        recorded_dois,
      });
      await page.reload({waitUntil: 'load'});

      await page.getByRole('link', {name: 'History'}).click();
      const modal = page.locator('#historyModal');
      await expect(modal).toBeVisible();

      const expected = [
        {text: 'Another title 2', divider: false},
        {text: '↑ Saved / Unsaved ↓', divider: true},
        {text: '3. Title', divider: false},
        {text: 'Some title 1', divider: false},
      ];
      for (let i = 0; i < expected.length; i++) {
        await expect(modal.getByRole('option').nth(i)).toHaveText(expected[i].text);
        await expect(modal.getByRole('option').nth(i)).toBeEnabled({enabled: !expected[i].divider});
      }
    });

    test('select a DOI in history modal', async ({page}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        recorded_dois: [{doi, title: '', save: false}] as HistoryDoi[],
      });
      await page.reload({waitUntil: 'load'});

      await page.getByRole('link', {name: 'History'}).click();
      const modal = page.locator('#historyModal');
      await expect(modal).toBeVisible();
      await modal.getByRole('option', {name: doi}).click();
      await expect(modal).toBeHidden();
      await expect(page.getByLabel('DOI')).toHaveValue(doi);
    });

    test('select a DOI title in history modal', async ({page}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_showtitles: true,
        recorded_dois: [{doi, title, save: false}] as HistoryDoi[],
      });
      await page.reload({waitUntil: 'load'});

      await page.getByRole('link', {name: 'History'}).click();
      const modal = page.locator('#historyModal');
      await expect(modal).toBeVisible();
      await modal.getByRole('option', {name: title}).click();
      await expect(modal).toBeHidden();
      await expect(page.getByLabel('DOI')).toHaveValue(doi);
    });

    test('sort DOIs in history modal', async ({page}) => {
      const recorded_dois: HistoryDoi[] = [
        {doi: '10.1000/2', title: 'A', save: false},
        {doi: '10.1000/1', title: 'B', save: false},
        {doi: '10.1000/3', title: 'C', save: false},
      ];
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        recorded_dois,
      });

      const updateSortAndGetLocator = async (sortBy: HistorySort) => {
        await page.evaluate((s) => chrome.storage.local.set(s), {history_sortby: sortBy});
        await page.reload({waitUntil: 'load'});

        await page.getByRole('link', {name: 'History'}).click();
        const modal = page.locator('#historyModal');
        await expect(modal).toBeVisible();
        return modal.getByRole('option', {disabled: false});
      };

      const expectedByDate = ['10.1000/3', '10.1000/1', '10.1000/2'];
      const optionsByDate = await updateSortAndGetLocator(HistorySort.Date);
      for (let i = 0; i < expectedByDate.length; i++) {
        await expect(optionsByDate.nth(i)).toHaveText(expectedByDate[i]);
      }

      const expectedByDoi = ['10.1000/1', '10.1000/2', '10.1000/3'];
      const optionsByDoi = await updateSortAndGetLocator(HistorySort.Doi);
      for (let i = 0; i < expectedByDoi.length; i++) {
        await expect(optionsByDoi.nth(i)).toHaveText(expectedByDoi[i]);
      }

      const expectedByTitle = ['10.1000/2', '10.1000/1', '10.1000/3'];
      const optionsByTitle = await updateSortAndGetLocator(HistorySort.Title);
      for (let i = 0; i < expectedByTitle.length; i++) {
        await expect(optionsByTitle.nth(i)).toHaveText(expectedByTitle[i]);
      }

      await page.evaluate((s) => chrome.storage.local.set(s), {
        recorded_dois: [
          ...recorded_dois,
          {doi: '10.1000/4', title: 'D', save: true},
          {doi: '10.1000/5', title: 'E', save: false},
        ],
      });

      const expectedBySave = ['10.1000/4', '10.1000/5', '10.1000/3', '10.1000/1', '10.1000/2'];
      const optionsBySave = await updateSortAndGetLocator(HistorySort.Save);
      for (let i = 0; i < expectedBySave.length; i++) {
        await expect(optionsBySave.nth(i)).toHaveText(expectedBySave[i]);
      }
    });
  });
});

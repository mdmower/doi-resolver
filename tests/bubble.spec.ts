import {test, expect} from './fixtures';
import {DisplayTheme, HistoryDoi, HistorySort} from '../src/lib/options';
import {getStorageValue, handbookDoi, handbookShortDoi} from './utils';

test.describe('Bubble', () => {
  test.beforeEach(async ({page, extension}) => {
    await page.goto(extension.urls.bubble);
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

  test('navigation to DOI', async ({page, context}) => {
    await page.getByPlaceholder('DOI').fill(handbookDoi);
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL('https://www.doi.org/the-identifier/resources/handbook/');
  });

  test('navigation to ShortDOI', async ({page, context}) => {
    await page.getByPlaceholder('DOI').fill(handbookShortDoi);
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL('https://www.doi.org/the-identifier/resources/handbook/');
  });

  test('invalid DOI notification', async ({page, context}) => {
    await page.getByPlaceholder('DOI').fill(`a${handbookDoi}`);
    await page.getByRole('button', {name: 'Go'}).click();
    await expect(page.getByText('Not a valid DOI')).toBeVisible();
    await page.getByPlaceholder('DOI').press('Home');
    await page.getByPlaceholder('DOI').press('Delete');
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    await newPagePromise;
    expect(page.isClosed()).toBe(true);
  });

  test('additional button display', async ({page}) => {
    const getButtons = () =>
      Promise.all([
        page.getByRole('button', {name: 'Go'}),
        page.getByRole('button', {name: 'Options'}),
        page.getByRole('button', {name: 'Citation'}),
        page.getByRole('button', {name: 'QR'}),
      ]);

    const [go1, options1, citation1, qr1] = await getButtons();
    await expect(go1).toHaveCount(1);
    await expect(options1).toHaveCount(1);
    await expect(citation1).toHaveCount(1);
    await expect(qr1).toHaveCount(1);

    await page.evaluate((s) => chrome.storage.local.set(s), {meta_buttons: false});
    await page.reload({waitUntil: 'load'});
    const [go2, options2, citation2, qr2] = await getButtons();
    await expect(go2).toHaveCount(1);
    await expect(options2).toHaveCount(0);
    await expect(citation2).toHaveCount(0);
    await expect(qr2).toHaveCount(0);
  });

  test('custom DOI resolver (default)', async ({context, page}) => {
    await expect(page.getByPlaceholder('DOI')).toBeVisible();
    await expect(page.locator('#crRadios')).toBeHidden();

    await page.evaluate((s) => chrome.storage.local.set(s), {
      custom_resolver: true,
      cr_bubble: 'default',
      doi_resolver: 'https://example.com/',
    });
    await page.reload({waitUntil: 'load'});

    await page.getByPlaceholder('DOI').fill(handbookDoi);
    await expect(page.locator('#crRadios')).toBeHidden();
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL('https://www.doi.org/the-identifier/resources/handbook/');
  });

  test('custom DOI resolver (custom)', async ({context, page}) => {
    await expect(page.getByPlaceholder('DOI')).toBeVisible();
    await expect(page.locator('#crRadios')).toBeHidden();

    await page.evaluate((s) => chrome.storage.local.set(s), {
      custom_resolver: true,
      cr_bubble: 'custom',
      doi_resolver: 'https://example.com/',
    });
    await page.reload({waitUntil: 'load'});

    await page.getByPlaceholder('DOI').fill(handbookDoi);
    await expect(page.locator('#crRadios')).toBeHidden();
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL(`https://example.com/${handbookDoi}`);
  });

  test('custom DOI resolver (selectable: default)', async ({context, page, serviceWorker}) => {
    await expect(page.getByPlaceholder('DOI')).toBeVisible();
    await expect(page.locator('#crRadios')).toBeHidden();

    await page.evaluate((s) => chrome.storage.local.set(s), {
      custom_resolver: true,
      cr_bubble: 'selectable',
      cr_bubble_last: 'custom',
      doi_resolver: 'https://example.com/',
    });
    await page.reload({waitUntil: 'load'});

    await page.getByPlaceholder('DOI').fill(handbookDoi);
    await expect(page.locator('#crRadios')).toBeVisible();
    await expect(page.locator('#crRadios').getByLabel('Custom')).toBeChecked();
    await page.locator('#crRadios').getByLabel('Default').click();
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL('https://www.doi.org/the-identifier/resources/handbook/');
    expect(await getStorageValue(serviceWorker, 'cr_bubble_last')).toBe('default');
  });

  test('custom DOI resolver (selectable: custom)', async ({context, page, serviceWorker}) => {
    await expect(page.getByPlaceholder('DOI')).toBeVisible();
    await expect(page.locator('#crRadios')).toBeHidden();

    await page.evaluate((s) => chrome.storage.local.set(s), {
      custom_resolver: true,
      cr_bubble: 'selectable',
      cr_bubble_last: 'default',
      doi_resolver: 'https://example.com/',
    });
    await page.reload({waitUntil: 'load'});

    await page.getByPlaceholder('DOI').fill(handbookDoi);
    await expect(page.locator('#crRadios')).toBeVisible();
    await expect(page.locator('#crRadios').getByLabel('Default')).toBeChecked();
    await page.locator('#crRadios').getByLabel('Custom').click();
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL(`https://example.com/${handbookDoi}`);
    expect(await getStorageValue(serviceWorker, 'cr_bubble_last')).toBe('custom');
  });

  test('custom ShortDOI resolver (default)', async ({context, page}) => {
    await expect(page.getByPlaceholder('DOI')).toBeVisible();
    await expect(page.locator('#crRadios')).toBeHidden();

    await page.evaluate((s) => chrome.storage.local.set(s), {
      custom_resolver: true,
      cr_bubble: 'default',
      shortdoi_resolver: 'https://example.com/',
    });
    await page.reload({waitUntil: 'load'});

    await page.getByPlaceholder('DOI').fill(handbookShortDoi);
    await expect(page.locator('#crRadios')).toBeHidden();
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL('https://www.doi.org/the-identifier/resources/handbook/');
  });

  test('custom ShortDOI resolver (custom)', async ({context, page}) => {
    await expect(page.getByPlaceholder('DOI')).toBeVisible();
    await expect(page.locator('#crRadios')).toBeHidden();

    await page.evaluate((s) => chrome.storage.local.set(s), {
      custom_resolver: true,
      cr_bubble: 'custom',
      shortdoi_resolver: 'https://example.com/',
    });
    await page.reload({waitUntil: 'load'});

    await page.getByPlaceholder('DOI').fill(handbookShortDoi);
    await expect(page.locator('#crRadios')).toBeHidden();
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL(`https://example.com/${handbookShortDoi.replace('10/', '')}`);
  });

  test('custom ShortDOI resolver (selectable: default)', async ({context, page, serviceWorker}) => {
    await expect(page.getByPlaceholder('DOI')).toBeVisible();
    await expect(page.locator('#crRadios')).toBeHidden();

    await page.evaluate((s) => chrome.storage.local.set(s), {
      custom_resolver: true,
      cr_bubble: 'selectable',
      cr_bubble_last: 'custom',
      shortdoi_resolver: 'https://example.com/',
    });
    await page.reload({waitUntil: 'load'});

    await page.getByPlaceholder('DOI').fill(handbookShortDoi);
    await expect(page.locator('#crRadios')).toBeVisible();
    await expect(page.locator('#crRadios').getByLabel('Custom')).toBeChecked();
    await page.locator('#crRadios').getByLabel('Default').click();
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL('https://www.doi.org/the-identifier/resources/handbook/');
    expect(await getStorageValue(serviceWorker, 'cr_bubble_last')).toBe('default');
  });

  test('custom ShortDOI resolver (selectable: custom)', async ({context, page, serviceWorker}) => {
    await expect(page.getByPlaceholder('DOI')).toBeVisible();
    await expect(page.locator('#crRadios')).toBeHidden();

    await page.evaluate((s) => chrome.storage.local.set(s), {
      custom_resolver: true,
      cr_bubble: 'selectable',
      cr_bubble_last: 'default',
      shortdoi_resolver: 'https://example.com/',
    });
    await page.reload({waitUntil: 'load'});

    await page.getByPlaceholder('DOI').fill(handbookShortDoi);
    await expect(page.locator('#crRadios')).toBeVisible();
    await expect(page.locator('#crRadios').getByLabel('Default')).toBeChecked();
    await page.locator('#crRadios').getByLabel('Custom').click();
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Go'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL(`https://example.com/${handbookShortDoi.replace('10/', '')}`);
    expect(await getStorageValue(serviceWorker, 'cr_bubble_last')).toBe('custom');
  });

  test('open options page', async ({page, context, extension}) => {
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Options'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    await expect(newPage).toHaveURL(extension.urls.options);
  });

  test('open citation page', async ({page, context, extension}) => {
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Citation'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    const url = new URL(extension.urls.citation);
    url.searchParams.append('doi', '');
    await expect(newPage).toHaveURL(extension.urls.citation + '?doi=');
  });

  test('open citation page with DOI', async ({page, context, extension}) => {
    await page.getByPlaceholder('DOI').fill(handbookDoi);
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Citation'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    const url = new URL(extension.urls.citation);
    url.searchParams.append('doi', handbookDoi);
    await expect(newPage).toHaveURL(url.href);
  });

  test('open citation page with invalid DOI', async ({page, context, extension}) => {
    await page.getByPlaceholder('DOI').fill(`a${handbookDoi}`);
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'Citation'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    const url = new URL(extension.urls.citation);
    url.searchParams.append('doi', `a${handbookDoi}`);
    await expect(newPage).toHaveURL(url.href);
  });

  test('open QR page', async ({page, context, extension}) => {
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'QR'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    const url = new URL(extension.urls.qr);
    url.searchParams.append('doi', '');
    await expect(newPage).toHaveURL(url.href);
  });

  test('open QR page with DOI', async ({page, context, extension}) => {
    await page.getByPlaceholder('DOI').fill(handbookDoi);
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'QR'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    const url = new URL(extension.urls.qr);
    url.searchParams.append('doi', handbookDoi);
    await expect(newPage).toHaveURL(url.href);
  });

  test('open QR page with invalid DOI', async ({page, context, extension}) => {
    await page.getByPlaceholder('DOI').fill(`a${handbookDoi}`);
    const newPagePromise = context.waitForEvent('page');
    await page.getByRole('button', {name: 'QR'}).click();
    const newPage = await newPagePromise;
    expect(page.isClosed()).toBe(true);
    const url = new URL(extension.urls.qr);
    url.searchParams.append('doi', `a${handbookDoi}`);
    await expect(newPage).toHaveURL(url.href);
  });

  test.describe('History', () => {
    test('record DOI on navigation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {history: true});
      await page.getByPlaceholder('DOI').fill('10.1045/january99-bearman');
      await page.getByRole('button', {name: 'Go'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi: '10.1045/january99-bearman', title: '', save: false}]);
    });

    test('record ShortDOI on navigation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {history: true});
      await page.getByPlaceholder('DOI').fill('10/cg7cd4');
      await page.getByRole('button', {name: 'Go'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi: '10/cg7cd4', title: '', save: false}]);
    });

    test('record DOI with title on navigation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_fetch_title: true,
      });
      await page.getByPlaceholder('DOI').fill('10.1045/january99-bearman');
      await page.getByRole('button', {name: 'Go'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([
          {
            title: 'A Common Model to Support Interoperable Metadata',
            doi: '10.1045/january99-bearman',
            save: false,
          },
        ]);
    });

    test('record ShortDOI with title on navigation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_fetch_title: true,
      });
      await page.getByPlaceholder('DOI').fill('10/cg7cd4');
      await page.getByRole('button', {name: 'Go'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([
          {
            title: 'A Common Model to Support Interoperable Metadata',
            doi: '10/cg7cd4',
            save: false,
          },
        ]);
    });

    test('exceed history length on navigation (none saved)', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_length: 3,
        recorded_dois: [
          {doi: '10.1000/1', title: '', save: false},
          {doi: '10.1000/2', title: '', save: false},
          {doi: '10/3', title: '', save: false},
        ],
      });
      await page.getByPlaceholder('DOI').fill('10.1045/january99-bearman');
      await page.getByRole('button', {name: 'Go'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([
          {doi: '10.1000/2', title: '', save: false},
          {doi: '10/3', title: '', save: false},
          {doi: '10.1045/january99-bearman', title: '', save: false},
        ]);
    });

    test('exceed history length on navigation (some saved)', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_length: 3,
        recorded_dois: [
          {doi: '10.1000/1', title: '', save: true},
          {doi: '10.1000/2', title: '', save: false},
          {doi: '10/3', title: '', save: false},
        ],
      });
      await page.getByPlaceholder('DOI').fill('10.1045/january99-bearman');
      await page.getByRole('button', {name: 'Go'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([
          {doi: '10.1000/1', title: '', save: true},
          {doi: '10/3', title: '', save: false},
          {doi: '10.1045/january99-bearman', title: '', save: false},
        ]);
    });

    test('show DOIs in history selection', async ({page}) => {
      let options = await page.getByRole('option').all();
      expect(options).toHaveLength(0);

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

      options = await page.getByRole('option').all();
      const optionsData = await Promise.all(
        options.map(async (option) => ({
          text: await option.textContent(),
          divider: await option.isDisabled(),
        }))
      );
      expect(optionsData).toEqual([
        {text: '10.1000/2', divider: false},
        {text: '', divider: true},
        {text: '10/3', divider: false},
        {text: '10.1000/1', divider: false},
      ]);
    });

    test('show DOI titles in history selection', async ({page}) => {
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

      const options = await page.getByRole('option').all();
      const optionsData = await Promise.all(
        options.map(async (option) => ({
          text: await option.textContent(),
          divider: await option.isDisabled(),
        }))
      );
      expect(optionsData).toEqual([
        {text: 'Another title 2', divider: false},
        {text: '', divider: true},
        {text: '3. Title', divider: false},
        {text: 'Some title 1', divider: false},
      ]);
    });

    test('select a DOI in history selection', async ({page}) => {
      const recorded_dois: HistoryDoi[] = [{doi: handbookDoi, title: '', save: false}];
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        recorded_dois,
      });
      await page.reload({waitUntil: 'load'});

      await page.getByRole('option', {name: handbookDoi}).click();
      await expect(page.getByRole('textbox')).toHaveValue(handbookDoi);
    });

    test('select a DOI title in history selection', async ({page}) => {
      const recorded_dois: HistoryDoi[] = [
        {doi: handbookDoi, title: 'Handbook title', save: false},
      ];
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_showtitles: true,
        recorded_dois,
      });
      await page.reload({waitUntil: 'load'});

      await page.getByRole('option', {name: 'Handbook title'}).click();
      await expect(page.getByRole('textbox')).toHaveValue(handbookDoi);
    });

    test('sort DOIs in history selection', async ({page}) => {
      const recorded_dois: HistoryDoi[] = [
        {doi: '10.1000/2', title: 'A', save: false},
        {doi: '10.1000/1', title: 'B', save: false},
        {doi: '10.1000/3', title: 'C', save: false},
      ];
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        recorded_dois,
      });

      const getOrderedDois = async (sortBy: HistorySort) => {
        await page.evaluate((s) => chrome.storage.local.set(s), {history_sortby: sortBy});
        await page.reload({waitUntil: 'load'});

        const options = await page.getByRole('option', {disabled: false}).all();
        return await Promise.all(options.map((option) => option.textContent()));
      };

      const doisByDate = await getOrderedDois(HistorySort.Date);
      expect(doisByDate).toEqual(['10.1000/3', '10.1000/1', '10.1000/2']);

      const doisByDoi = await getOrderedDois(HistorySort.Doi);
      expect(doisByDoi).toEqual(['10.1000/1', '10.1000/2', '10.1000/3']);

      const doisByTitle = await getOrderedDois(HistorySort.Title);
      expect(doisByTitle).toEqual(['10.1000/2', '10.1000/1', '10.1000/3']);

      await page.evaluate((s) => chrome.storage.local.set(s), {
        recorded_dois: [
          ...recorded_dois,
          {doi: '10.1000/4', title: 'D', save: true},
          {doi: '10.1000/5', title: 'E', save: false},
        ],
      });

      const doisBySave = await getOrderedDois(HistorySort.Save);
      expect(doisBySave).toEqual(['10.1000/4', '10.1000/5', '10.1000/3', '10.1000/1', '10.1000/2']);
    });
  });
});

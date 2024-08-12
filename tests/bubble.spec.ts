import {test, expect} from './fixtures';
import {DisplayTheme, HistoryDoi, HistorySort} from '../src/lib/options';
import {handbookDoi} from './utils';

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
    const waitForRecordedDoi = ({requireTitle}: {requireTitle: boolean}) =>
      new Promise<HistoryDoi>((resolve, reject) => {
        const changeHandler = (changes: Record<string, chrome.storage.StorageChange>) => {
          const recordedDois = changes.recorded_dois?.newValue as HistoryDoi[] | undefined;
          if (!recordedDois?.length) {
            return;
          }

          const recordedDoi = requireTitle
            ? recordedDois[0].title
              ? recordedDois[0]
              : undefined
            : recordedDois[0];
          if (recordedDoi) {
            clearTimeout(timeout);
            chrome.storage.onChanged.removeListener(changeHandler);
            resolve(recordedDoi);
          }
        };

        const timeout = setTimeout(() => {
          chrome.storage.onChanged.removeListener(changeHandler);
          reject();
        }, 5000);

        chrome.storage.onChanged.addListener(changeHandler);
      });

    test('record DOI on navigation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {history: true});
      await page.getByPlaceholder('DOI').fill('10.1045/january99-bearman');
      const recordDoiPromise = serviceWorker.evaluate(waitForRecordedDoi, {requireTitle: false});
      await page.getByRole('button', {name: 'Go'}).click();
      const recordedDoi = await recordDoiPromise;
      expect(recordedDoi).toEqual({
        title: '',
        doi: '10.1045/january99-bearman',
        save: false,
      });
    });

    test('record DOI with title on navigation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_fetch_title: true,
      });
      await page.getByPlaceholder('DOI').fill('10.1045/january99-bearman');
      const recordDoiPromise = serviceWorker.evaluate(waitForRecordedDoi, {requireTitle: true});
      await page.getByRole('button', {name: 'Go'}).click();
      const recordedDoi = await recordDoiPromise;
      expect(recordedDoi).toEqual({
        title: 'A Common Model to Support Interoperable Metadata',
        doi: '10.1045/january99-bearman',
        save: false,
      });
    });

    test('show DOIs in history selection', async ({page}) => {
      let options = await page.getByRole('option').all();
      expect(options).toHaveLength(0);

      const recorded_dois: HistoryDoi[] = [
        {doi: '10.1000/1', title: '', save: false},
        {doi: '10.1000/2', title: '', save: true},
        {doi: '10.1000/3', title: '', save: false},
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
        {text: '10.1000/3', divider: false},
        {text: '10.1000/1', divider: false},
      ]);
    });

    test('show DOI titles in history selection', async ({page}) => {
      const recorded_dois: HistoryDoi[] = [
        {doi: '10.1000/1', title: 'Some title 1', save: false},
        {doi: '10.1000/2', title: 'Another title 2', save: true},
        {doi: '10.1000/3', title: '3. Title', save: false},
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

  // TODO: Test custom resolver
  // TODO: Test cr_bubble_last updates when custom resolver choice changes
});

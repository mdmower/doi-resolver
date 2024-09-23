import {test, expect} from './fixtures';
import {DisplayTheme, HistoryDoi, HistorySort} from '../src/lib/options';
import {getStorageValue} from './utils';
import {Locator} from '@playwright/test';

test.describe('QR', () => {
  const title = 'A Common Model to Support Interoperable Metadata';
  const doi = '10.1045/january99-bearman';

  const getCanvasInfo = async (qr: Locator) => {
    await expect(qr).toBeVisible();

    const width = parseInt((await qr.getAttribute('width')) ?? '');
    const height = parseInt((await qr.getAttribute('height')) ?? '');
    const {fg, bg} = await qr.evaluate((canvas: HTMLCanvasElement) => {
      const toHex = (imgData: ImageData) =>
        '#' + [...imgData.data].map((x) => x.toString(16).padStart(2, '0')).join('');

      const ctx = canvas.getContext('2d', {willReadFrequently: true});
      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }
      return {
        fg: toHex(ctx.getImageData(0, 0, 1, 1)),
        bg: toHex(ctx.getImageData(15, 15, 1, 1)),
      };
    });

    return {width, height, fg, bg};
  };

  test.beforeEach(async ({page, extension}) => {
    const search = '?' + new URLSearchParams({doi}).toString();
    await page.goto(extension.urls.qr + search);
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
    await expect(page.getByLabel('Size')).toHaveValue('300');
    await expect(page.getByLabel('Border')).toHaveValue('0');
    await expect(page.getByLabel('PNG')).toBeChecked({checked: true});
    await expect(page.getByLabel('SVG')).toBeChecked({checked: false});
    await expect(page.getByLabel('Transparent background')).toBeChecked({checked: false});
    await expect(page.getByLabel('Include message in QR code')).toBeChecked({checked: false});
    await expect(page.getByLabel('Message', {exact: true})).toBeHidden();
    await expect(page.getByLabel('Include title of reference in QR code')).toBeChecked({
      checked: false,
    });
    await expect(page.getByLabel('Foreground color')).toHaveValue('#000000');
    await expect(page.getByLabel('Background color')).toHaveValue('#ffffff');

    const notifyContainer = page.locator('#notifyDiv');
    const qrContainer = page.locator('#qrDiv');
    await expect(notifyContainer).toBeHidden();
    await expect(qrContainer).toBeHidden();
  });

  test('default QR generation', async ({page}) => {
    await page.getByRole('button', {name: 'Submit'}).click();

    const notifyContainer = page.locator('#notifyDiv');
    await expect(notifyContainer).toBeVisible();
    await expect(notifyContainer.getByText('Disabled')).toBeVisible();
    await expect(notifyContainer.getByText(`https://doi.org/${doi}`)).toBeVisible();

    const qr = page.locator('canvas');
    await expect
      .poll(() => getCanvasInfo(qr))
      .toEqual({
        width: 300,
        height: 300,
        fg: '#000000ff',
        bg: '#ffffffff',
      });
  });

  test('default ShortDOI generation', async ({page}) => {
    await page.getByLabel('DOI').fill('10/cg7cd4');
    await page.getByRole('button', {name: 'Submit'}).click();

    const notifyContainer = page.locator('#notifyDiv');
    await expect(notifyContainer).toBeVisible();
    await expect(notifyContainer.getByText('Disabled')).toBeVisible();
    await expect(notifyContainer.getByText('https://doi.org/cg7cd4')).toBeVisible();

    const qr = page.locator('canvas');
    await expect
      .poll(() => getCanvasInfo(qr))
      .toEqual({
        width: 300,
        height: 300,
        fg: '#000000ff',
        bg: '#ffffffff',
      });
  });

  test('invalid DOI', async ({page}) => {
    await page.getByLabel('DOI').clear();
    await page.getByRole('button', {name: 'Submit'}).click();
    await expect(page.getByText('Not a valid DOI')).toBeVisible();
    await page.getByLabel('DOI').fill('abc');
    await page.getByRole('button', {name: 'Submit'}).click();
    await expect(page.getByText('Not a valid DOI')).toBeVisible();
  });

  test('download PNG', async ({page}) => {
    await page.getByRole('button', {name: 'Submit'}).click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('a[download="qrImage.png"]').click();

    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const signature = [];
    for await (const chunk of stream) {
      signature.push(...(chunk as Uint8Array).slice(0, 8));
      break;
    }
    stream.destroy();
    expect(signature).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  test('download SVG', async ({page}) => {
    await page.getByLabel('SVG').click();
    await page.getByRole('button', {name: 'Submit'}).click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('a[download="qrImage.svg"]').click();

    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let signature = '';
    for await (const chunk of stream) {
      signature = Buffer.from((chunk as Uint8Array).slice(0, 4)).toString('utf-8');
      break;
    }
    stream.destroy();
    expect(signature).toBe('<svg');
  });

  test('QR generation with custom size', async ({page}) => {
    await page.getByLabel('Size').fill('500');
    await page.getByRole('button', {name: 'Submit'}).click();

    const qr = page.locator('canvas');
    await expect(qr).toHaveAttribute('width', '500');
    await expect(qr).toHaveAttribute('height', '500');
  });

  test('QR generation with border', async ({page}) => {
    await page.getByLabel('Border').fill('1');
    await page.getByRole('button', {name: 'Submit'}).click();

    const qr = page.locator('canvas');
    await expect
      .poll(() => getCanvasInfo(qr))
      .toEqual({
        width: 300,
        height: 300,
        // colors at (0,0) and (15,15) should be reversed when 1 module border exists
        fg: '#ffffffff',
        bg: '#000000ff',
      });
  });

  test('QR generation with custom colors', async ({page}) => {
    await page.getByLabel('Foreground color').fill('#000222');
    await page.getByLabel('Background color').fill('#fff222');
    await page.getByRole('button', {name: 'Submit'}).click();

    const qr = page.locator('canvas');
    await expect
      .poll(() => getCanvasInfo(qr))
      .toEqual({
        width: 300,
        height: 300,
        fg: '#000222ff',
        bg: '#fff222ff',
      });
  });

  test('QR generation with transparent background', async ({page}) => {
    await page.getByLabel('Foreground color').fill('#000222');
    await page.getByLabel('Background color').fill('#fff222');
    await page.getByLabel('Transparent background').click();
    await expect(page.getByLabel('Background color')).toBeDisabled();
    await page.getByRole('button', {name: 'Submit'}).click();

    const qr = page.locator('canvas');
    await expect
      .poll(() => getCanvasInfo(qr))
      .toEqual({
        width: 300,
        height: 300,
        fg: '#000222ff',
        bg: '#00000000',
      });
  });

  test('QR generation with custom message', async ({page}) => {
    const message = 'my custom message';
    await page.getByLabel('Include message in QR code').click();
    await expect(page.getByLabel('Message', {exact: true})).toBeVisible();
    await expect(page.getByLabel('Include title of reference in QR code')).toBeDisabled();
    await page.getByLabel('Message', {exact: true}).fill(message);
    await page.getByRole('button', {name: 'Submit'}).click();

    await expect(
      page.locator('#notifyDiv').getByText(`${message}\nhttps://doi.org/${doi}`)
    ).toBeVisible();
  });

  test('QR generation with title retrieval', async ({page}) => {
    await page.getByLabel('Include title of reference in QR code').click();
    await expect(page.getByLabel('Include message in QR code')).toBeDisabled();
    await page.getByRole('button', {name: 'Submit'}).click();

    const notifyContainer = page.locator('#notifyDiv');
    await expect(notifyContainer.getByText('Found')).toBeVisible();
    await expect(notifyContainer.getByText(`${title}\nhttps://doi.org/${doi}`)).toBeVisible();
  });

  test('fully customized SVG QR', async ({page}) => {
    await page.getByLabel('Size').fill('500');
    await page.getByLabel('Border').fill('2');
    await page.getByLabel('SVG').click();
    await page.getByLabel('Include title of reference in QR code').click();
    await page.getByLabel('Transparent background').click();
    await page.getByLabel('Foreground color').fill('#000222');
    await page.getByRole('button', {name: 'Submit'}).click();

    const notifyContainer = page.locator('#notifyDiv');
    await expect(notifyContainer.getByText('Found')).toBeVisible();
    await expect(notifyContainer.getByText(`${title}\nhttps://doi.org/${doi}`)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('a[download="qrImage.svg"]').click();

    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let signature = '';
    for await (const chunk of stream) {
      signature = Buffer.from((chunk as Uint8Array).slice(0, 4)).toString('utf-8');
      break;
    }
    stream.destroy();
    expect(signature).toBe('<svg');
  });

  test.describe('History', () => {
    test('record DOI on QR generation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {history: true});
      await page.getByRole('button', {name: 'Submit'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi, title: '', save: false}]);
    });

    test('record ShortDOI on QR generation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {history: true});
      await page.getByLabel('DOI').fill('10/cg7cd4');
      await page.getByRole('button', {name: 'Submit'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi: '10/cg7cd4', title: '', save: false}]);
    });

    test('record DOI with title on QR generation', async ({page, serviceWorker}) => {
      await page.evaluate((s) => chrome.storage.local.set(s), {
        history: true,
        history_fetch_title: true,
      });
      await page.getByRole('button', {name: 'Submit'}).click();
      await expect
        .poll(() => getStorageValue(serviceWorker, 'recorded_dois'))
        .toEqual([{doi, title, save: false}]);
    });

    test('record ShortDOI with title on QR generation', async ({page, serviceWorker}) => {
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

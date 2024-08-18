import {test, expect} from './fixtures';
import {
  DisplayTheme,
  OmniboxTab,
  CustomResolverSelection,
  getDefaultOptions,
  getSyncExclusionNames,
} from '../src/lib/options';
import {
  getCustomizedOptions,
  getStorageValue,
  handbookDoi,
  handbookShortDoi,
  optionLabels,
} from './utils';

test.describe('Options', () => {
  test.beforeEach(async ({page, extension}) => {
    await page.goto(extension.urls.options);
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

  // TODO: citation, qr, and notification pages should apply theme
  test('set display theme', async ({page}) => {
    const themes = Object.values(DisplayTheme);
    const select = page.getByLabel(optionLabels.theme);
    const options = await select.getByRole('option').all();
    expect(options).toHaveLength(themes.length);
    for (const theme of themes.reverse()) {
      await select.selectOption(theme);
      await expect.poll(() => getStorageValue(page, 'theme')).toBe(theme);
      await expect(select).toHaveValue(theme);
    }
  });

  // TODO: omnibox.spec.ts to test doi capture and open behavior
  test('set omnibox open behavior', async ({page}) => {
    const tabs = Object.values(OmniboxTab);
    const select = page.getByLabel(optionLabels.omnibox_tab);
    const options = await select.getByRole('option').all();
    expect(options).toHaveLength(tabs.length);
    for (const tab of tabs.reverse()) {
      await select.selectOption(tab);
      await expect.poll(() => getStorageValue(page, 'omnibox_tab')).toBe(tab);
      await expect(select).toHaveValue(tab);
    }
  });

  // TODO: history page should show notice when not enabled
  test('toggle history', async ({page}) => {
    const checkbox = page.getByLabel(optionLabels.history);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggle history changes suboption visibility', async ({page}) => {
    const suboptionsContainer = page.locator('#historySubOptions');
    const checkbox = page.getByLabel(optionLabels.history);
    await checkbox.click();
    await expect(suboptionsContainer).toBeVisible();
    await checkbox.click();
    await expect(suboptionsContainer).toBeHidden();
  });

  test('toggle history saved entries dropdown behavior', async ({page}) => {
    await page.getByLabel(optionLabels.history).click();
    const checkbox = page.getByLabel(optionLabels.history_showsave);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_showsave')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_showsave')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggle history show titles behavior', async ({page}) => {
    await page.getByLabel(optionLabels.history).click();
    const checkbox = page.getByLabel(optionLabels.history_showtitles);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_showtitles')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_showtitles')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  // TODO: Revise test for optional permissions handling
  test('toggle history title auto-fetch behavior', async ({page}) => {
    await page.getByLabel(optionLabels.history).click();
    const checkbox = page.getByLabel('Automatically fetch title when a new DOI is recorded');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_fetch_title')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_fetch_title')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  // TODO: Make sure history length setting works when recording DOIs
  test('history length bounds', async ({page}) => {
    const testLength = async (fillValue: number, expectValue: number) => {
      await input.fill(fillValue.toString());
      await input.blur();
      await expect.poll(() => getStorageValue(page, 'history_length')).toBe(expectValue);
      await expect(input).toHaveValue(expectValue.toString());
    };

    await page.getByLabel(optionLabels.history).click();
    const input = page.getByLabel(optionLabels.history_length);
    await testLength(1, 1);
    await testLength(0, 1);
    await testLength(-1, 1);
    await testLength(50, 50);
    await testLength(5000, 5000);
    await testLength(5001, 5000);
    await testLength(21.1, 21);
  });

  test('toggle context menu', async ({page}) => {
    const checkbox = page.getByLabel(optionLabels.context_menu);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu')).toBe(false);
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu')).toBe(true);
    await expect(checkbox).toBeChecked();
  });

  test('toggle context menu selection awareness', async ({page}) => {
    const checkbox = page.getByLabel(optionLabels.context_menu_match);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu_match')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu_match')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggling context menu affects selection awareness', async ({page}) => {
    const cmmCheckbox = page.getByLabel(optionLabels.context_menu_match);
    await cmmCheckbox.click();
    const cmCheckbox = page.getByLabel(optionLabels.context_menu);
    await cmCheckbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu')).toBe(false);
    await expect.poll(() => getStorageValue(page, 'context_menu_match')).toBe(false);
    await expect(cmCheckbox).not.toBeChecked();
    await expect(cmmCheckbox).not.toBeChecked();
    await expect(cmmCheckbox).toBeHidden();
    await cmCheckbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu')).toBe(true);
    await expect.poll(() => getStorageValue(page, 'context_menu_match')).toBe(false);
    await expect(cmCheckbox).toBeChecked();
    await expect(cmmCheckbox).not.toBeChecked();
    await expect(cmmCheckbox).toBeVisible();
  });

  test('context menu help modal', async ({page}) => {
    const modalTrigger = page.getByLabel('Open context menu information modal');
    await modalTrigger.click();
    const modal = page.locator('#infoModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('Context menu');
    await modal.getByLabel('Close').click();
    await expect(modal).toBeHidden();
  });

  test('context menu match permissions modal', async ({page}) => {
    const modalTrigger = page.getByLabel('Open context menu selected text permissions notice');
    await modalTrigger.click();
    const modal = page.locator('#infoModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('Context menu permissions');
    await modal.getByLabel('Close').click();
    await expect(modal).toBeHidden();
  });

  test('toggle QR and citation buttons', async ({page}) => {
    const checkbox = page.getByLabel(optionLabels.meta_buttons);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'meta_buttons')).toBe(false);
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'meta_buttons')).toBe(true);
    await expect(checkbox).toBeChecked();
  });

  test('QR and citation buttons help modal', async ({page}) => {
    const modalTrigger = page.getByLabel('Open QR and citation features information modal');
    await modalTrigger.click();
    const modal = page.locator('#infoModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('Additional buttons');
    await modal.getByLabel('Close').click();
    await expect(modal).toBeHidden();
  });

  test('toggle custom resolver', async ({page}) => {
    const checkbox = page.getByLabel(optionLabels.custom_resolver);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'custom_resolver')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'custom_resolver')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggle custom resolver changes suboption visibility', async ({page}) => {
    const suboptionsContainer = page.locator('#customResolverSubOptions');
    const checkbox = page.getByLabel(optionLabels.custom_resolver);
    await checkbox.click();
    await expect(suboptionsContainer).toBeVisible();
    await checkbox.click();
    await expect(suboptionsContainer).toBeHidden();
  });

  test('set custom DOI resolver', async ({page}) => {
    await page.getByLabel(optionLabels.custom_resolver).click();
    const input = page.getByLabel(optionLabels.doi_resolver);
    await input.fill('https://mydoi/');
    await expect.poll(() => getStorageValue(page, 'doi_resolver')).toBe('https://mydoi/');
    const preview = page.locator('#doiResolverOutput');
    await expect(preview).toContainText(`/mydoi/${handbookDoi}`);
  });

  test('set custom ShortDOI resolver', async ({page}) => {
    await page.getByLabel(optionLabels.custom_resolver).click();
    const input = page.getByLabel(optionLabels.shortdoi_resolver);
    await input.fill('https://mydoi/');
    await expect.poll(() => getStorageValue(page, 'shortdoi_resolver')).toBe('https://mydoi/');
    const preview = page.locator('#shortDoiResolverOutput');
    await expect(preview).toContainText(`/mydoi/${handbookShortDoi.replace('10/', '')}`);
  });

  test('set custom resolver choices (non-selectable)', async ({page}) => {
    await page.getByLabel(optionLabels.custom_resolver).click();
    const container = page.locator('#customResolverSubOptions');
    for (const key of ['cr_autolink', 'cr_context', 'cr_omnibox', 'cr_history'] as const) {
      const select = container.getByLabel(optionLabels[key]);
      await select.selectOption(CustomResolverSelection.Default);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Default);
      await select.selectOption(CustomResolverSelection.Custom);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Custom);
    }
  });

  test('set custom resolver choices (selectable)', async ({page}) => {
    await page.getByLabel(optionLabels.custom_resolver).click();
    const container = page.locator('#customResolverSubOptions');
    for (const key of ['cr_bubble'] as const) {
      const select = container.getByLabel(optionLabels[key]);
      await select.selectOption(CustomResolverSelection.Default);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Default);
      await select.selectOption(CustomResolverSelection.Custom);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Custom);
      await select.selectOption(CustomResolverSelection.Selectable);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Selectable);
    }
  });

  test('toggle autolink', async ({page}) => {
    const checkbox = page.getByLabel(optionLabels.auto_link);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'auto_link')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'auto_link')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggle autolink changes suboption visibility', async ({page}) => {
    const suboptionsContainer = page.locator('#autolinkSubOptions');
    const checkbox = page.getByLabel(optionLabels.auto_link);
    await checkbox.click();
    await expect(suboptionsContainer).toBeVisible();
    await checkbox.click();
    await expect(suboptionsContainer).toBeHidden();
  });

  test('toggle autolink rewrite', async ({page}) => {
    await page.getByLabel(optionLabels.auto_link).click();
    const checkbox = page.getByLabel(optionLabels.auto_link_rewrite);
    await expect(checkbox).toBeHidden();
    await page.getByLabel(optionLabels.custom_resolver).click();
    await expect(checkbox).toBeVisible();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'auto_link_rewrite')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'auto_link_rewrite')).toBe(false);
    await expect(checkbox).not.toBeChecked();
    await page.getByLabel(optionLabels.custom_resolver).click();
    await expect(checkbox).toBeHidden();
  });

  test('toggle autolink exclusions', async ({page}) => {
    await page.getByLabel(optionLabels.auto_link).click();
    const textarea = page.getByLabel(optionLabels.autolink_exclusions);
    const testInput = page.getByLabel('Test a URL for exclusion:');
    const rules = `
      abc.example.com
      /def\\.example\\.com/
      rst.example.com/rst/
      /xyz\\.example\\.com\\/xyz\\//
      http://abc.example.com
    `;
    await textarea.fill(rules);
    await expect
      .poll(() => getStorageValue(page, 'autolink_exclusions'))
      .toEqual([
        'abc.example.com',
        '/def\\.example\\.com/',
        'rst.example.com/rst/',
        '/xyz\\.example\\.com\\/xyz\\//',
        'abc.example.com',
      ]);
    const result = page.locator('#autolinkTestExclusionResult');
    await expect(result).toHaveText('');
    await testInput.fill('example.com');
    await expect(result).toContainText('Invalid URL');
    await testInput.fill('http://example.com/');
    await expect(result).toHaveText('No exclusion matched');
    await testInput.fill('http://abc.example.com/');
    await expect(result).toHaveText('Exclusion matched');
    await testInput.fill('http://x.abc.example.com/');
    await expect(result).toHaveText('No exclusion matched');
    await testInput.fill('http://x.def.example.com/');
    await expect(result).toHaveText('Exclusion matched');
    await testInput.fill('http://rst.example.com/');
    await expect(result).toHaveText('No exclusion matched');
    await testInput.fill('http://rst.example.com/rst/x');
    await expect(result).toHaveText('Exclusion matched');
    await testInput.fill('http://xyz.example.com/');
    await expect(result).toHaveText('No exclusion matched');
    await testInput.fill('http://xyz.example.com/xyz/x');
    await expect(result).toHaveText('Exclusion matched');
  });

  test('autolink permissions modal', async ({page}) => {
    const modalTrigger = page.getByLabel('Open autolink permissions notice');
    await modalTrigger.click();
    const modal = page.locator('#infoModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('Autolink permissions');
    await modal.getByLabel('Close').click();
    await expect(modal).toBeHidden();
  });

  test('autolink exclusions help modal', async ({page}) => {
    await page.getByLabel(optionLabels.auto_link).click();
    const modalTrigger = page.getByLabel('Open autolink exclusions information modal');
    await modalTrigger.click();
    const modal = page.locator('#infoModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('Autolink exclusions');
    await modal.getByLabel('Close').click();
    await expect(modal).toBeHidden();
  });

  test('toggle sync with no cloud settings', async ({page}) => {
    const localStg = getCustomizedOptions() as Record<string, unknown>;
    await page.evaluate((stg) => chrome.storage.local.set(stg), localStg);
    const syncStg = await page.evaluate(() => chrome.storage.sync.get());
    expect(syncStg).toEqual({});

    const nonSyncKeys = getSyncExclusionNames() as string[];
    const expectedSyncStg = Object.keys(localStg).reduce(
      (stg, key) => (nonSyncKeys.includes(key) ? stg : {...stg, [key]: localStg[key]}),
      {} as Record<string, unknown>
    );
    const checkbox = page.getByLabel(optionLabels.sync_data);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'sync_data')).toBe(true);
    await expect
      .poll(() => page.evaluate(() => chrome.storage.sync.get()))
      .toEqual(expectedSyncStg);
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'sync_data')).toBe(false);
    await expect
      .poll(() => page.evaluate(() => chrome.storage.sync.get()))
      .toEqual(expectedSyncStg);
  });

  test('toggle sync with cloud settings', async ({page}) => {
    const nonSyncKeys = getSyncExclusionNames() as string[];
    const customOptions = getCustomizedOptions() as Record<string, unknown>;
    const syncStg = Object.keys(customOptions).reduce(
      (stg, key) => (nonSyncKeys.includes(key) ? stg : {...stg, [key]: customOptions[key]}),
      {} as Record<string, unknown>
    );
    await page.evaluate((stg) => chrome.storage.sync.set(stg), syncStg);
    const localStg = await page.evaluate(() => chrome.storage.local.get());
    expect(localStg).toEqual(getDefaultOptions());

    const expectedLocalStg = Object.keys(localStg).reduce(
      (stg, key) =>
        nonSyncKeys.includes(key)
          ? {...stg, [key]: localStg[key] as unknown}
          : {...stg, [key]: syncStg[key]},
      {} as Record<string, unknown>
    );
    const checkbox = page.getByLabel(optionLabels.sync_data);
    await checkbox.click();
    await expect
      .poll(() => page.evaluate(() => chrome.storage.local.get()))
      .toEqual({...expectedLocalStg, sync_data: true});
    await expect.poll(() => page.evaluate(() => chrome.storage.sync.get())).toEqual(syncStg);
    await checkbox.click();
    await expect
      .poll(() => page.evaluate(() => chrome.storage.local.get()))
      .toEqual({...expectedLocalStg, sync_data: false});
    await expect.poll(() => page.evaluate(() => chrome.storage.sync.get())).toEqual(syncStg);
  });

  test('synchronize changed settings when sync enabled', async ({page}) => {
    await page.getByLabel(optionLabels.sync_data).click();
    await expect.poll(() => getStorageValue(page, 'sync_data')).toBe(true);

    await page.getByLabel(optionLabels.history).click();
    await page.getByLabel(optionLabels.history_length).fill('75');
    await page.getByLabel(optionLabels.meta_buttons).click();
    const localStg = {
      ...getDefaultOptions(),
      history: true,
      history_length: 75,
      meta_buttons: false,
    } as Record<string, unknown>;
    const nonSyncKeys = getSyncExclusionNames() as string[];
    const expectedSyncStg = Object.keys(localStg).reduce(
      (stg, key) => (nonSyncKeys.includes(key) ? stg : {...stg, [key]: localStg[key]}),
      {} as Record<string, unknown>
    );
    await expect
      .poll(() => page.evaluate(() => chrome.storage.sync.get()))
      .toEqual(expectedSyncStg);
  });

  test('ignore changed settings when sync disabled', async ({page}) => {
    await page.getByLabel(optionLabels.theme).selectOption('light');
    const syncStg = {
      theme: 'dark',
      history: true,
      history_length: 75,
      meta_buttons: false,
    };
    await page.evaluate((stg) => chrome.storage.sync.set(stg), syncStg);
    await expect.poll(() => page.evaluate(() => chrome.storage.sync.get())).toEqual(syncStg);
    await expect.poll(() => getStorageValue(page, 'theme')).toBe('light');
    await expect.poll(() => getStorageValue(page, 'history')).toBe(false);
    await expect.poll(() => getStorageValue(page, 'history_length')).toBe(50);
    await expect.poll(() => getStorageValue(page, 'meta_buttons')).toBe(true);
  });

  test('reset sync', async ({page}) => {
    await page.getByLabel(optionLabels.sync_data).click();
    await expect.poll(() => getStorageValue(page, 'sync_data')).toBe(true);

    await page.getByLabel(optionLabels.history).click();
    const localStg = {...getDefaultOptions(), history: true} as Record<string, unknown>;
    const nonSyncKeys = getSyncExclusionNames() as string[];
    const expectedSyncStg = Object.keys(localStg).reduce(
      (stg, key) => (nonSyncKeys.includes(key) ? stg : {...stg, [key]: localStg[key]}),
      {} as Record<string, unknown>
    );
    await expect
      .poll(() => page.evaluate(() => chrome.storage.sync.get()))
      .toEqual(expectedSyncStg);
    await page.getByRole('button', {name: 'Reset Sync'}).click();
    await expect.poll(() => page.evaluate(() => chrome.storage.sync.get())).toEqual({});
    await expect(page.getByLabel(optionLabels.sync_data)).not.toBeChecked();
    await expect.poll(() => page.evaluate(() => chrome.storage.local.get())).toEqual(localStg);
  });

  test('sync help modal', async ({page}) => {
    const modalTrigger = page.getByLabel('Open sync information modal');
    await modalTrigger.click();
    const modal = page.locator('#infoModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('Sync');
    await modal.getByLabel('Close').click();
    await expect(modal).toBeHidden();
  });

  test('load settings', async ({page}) => {
    const localStg = getCustomizedOptions();
    await page.evaluate((stg) => chrome.storage.local.set(stg), localStg);
    // This test is about restoring options on page load, so even though a page reload isn't necessary (because the
    // storage change listener is active), it is intentional.
    await page.reload({waitUntil: 'load'});

    await expect(page.getByLabel(optionLabels.theme)).toHaveValue(localStg.theme);
    await expect(page.getByLabel(optionLabels.omnibox_tab)).toHaveValue(localStg.omnibox_tab);
    await expect(page.getByLabel(optionLabels.history)).toBeChecked({checked: localStg.history});
    await expect(page.getByLabel(optionLabels.history_showsave)).toBeChecked({
      checked: localStg.history_showsave,
    });
    await expect(page.getByLabel(optionLabels.history_showtitles)).toBeChecked({
      checked: localStg.history_showtitles,
    });
    await expect(page.getByLabel(optionLabels.history_fetch_title)).toBeChecked({
      checked: localStg.history_fetch_title,
    });
    await expect(page.getByLabel(optionLabels.history_length)).toHaveValue(
      localStg.history_length.toString()
    );
    await expect(page.getByLabel(optionLabels.context_menu)).toBeChecked({
      checked: localStg.context_menu,
    });
    await expect(page.getByLabel(optionLabels.context_menu_match)).toBeChecked({
      checked: localStg.context_menu_match,
    });
    await expect(page.getByLabel(optionLabels.meta_buttons)).toBeChecked({
      checked: localStg.meta_buttons,
    });
    await expect(page.getByLabel(optionLabels.custom_resolver)).toBeChecked({
      checked: localStg.custom_resolver,
    });
    await expect(page.getByLabel(optionLabels.doi_resolver)).toHaveValue(localStg.doi_resolver);
    await expect(page.getByLabel(optionLabels.shortdoi_resolver)).toHaveValue(
      localStg.shortdoi_resolver
    );
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_autolink)
    ).toHaveValue(localStg.cr_autolink);
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_bubble)
    ).toHaveValue(localStg.cr_bubble);
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_context)
    ).toHaveValue(localStg.cr_context);
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_omnibox)
    ).toHaveValue(localStg.cr_omnibox);
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_history)
    ).toHaveValue(localStg.cr_history);
    await expect(page.getByLabel(optionLabels.auto_link)).toBeChecked({
      checked: localStg.auto_link,
    });
    await expect(page.getByLabel(optionLabels.auto_link_rewrite)).toBeChecked({
      checked: localStg.auto_link_rewrite,
    });
    await expect(page.getByLabel(optionLabels.autolink_exclusions)).toHaveValue(
      localStg.autolink_exclusions.join('\n')
    );
    await expect(page.getByLabel(optionLabels.sync_data)).toBeChecked({
      checked: localStg.sync_data,
    });
  });

  test('dynamically update UI with sync changes', async ({page}) => {
    await page.getByLabel(optionLabels.sync_data).click();
    await expect.poll(() => getStorageValue(page, 'sync_data')).toBe(true);

    const nonSyncKeys = getSyncExclusionNames() as string[];
    const updatedStg = getCustomizedOptions() as Record<string, unknown>;
    const syncStg = Object.keys(updatedStg).reduce(
      (stg, key) => (nonSyncKeys.includes(key) ? stg : {...stg, [key]: updatedStg[key]}),
      {} as Record<string, unknown>
    );

    await page.evaluate((stg) => chrome.storage.sync.set(stg), syncStg);
    const localStg = {
      ...getDefaultOptions(),
      ...syncStg,
      sync_data: true,
    };

    await expect(page.getByLabel(optionLabels.theme)).toHaveValue(localStg.theme);
    await expect(page.getByLabel(optionLabels.omnibox_tab)).toHaveValue(localStg.omnibox_tab);
    await expect(page.getByLabel(optionLabels.history)).toBeChecked({checked: localStg.history});
    await expect(page.getByLabel(optionLabels.history_showsave)).toBeChecked({
      checked: localStg.history_showsave,
    });
    await expect(page.getByLabel(optionLabels.history_showtitles)).toBeChecked({
      checked: localStg.history_showtitles,
    });
    await expect(page.getByLabel(optionLabels.history_fetch_title)).toBeChecked({
      checked: localStg.history_fetch_title,
    });
    await expect(page.getByLabel(optionLabels.history_length)).toHaveValue(
      localStg.history_length.toString()
    );
    await expect(page.getByLabel(optionLabels.context_menu)).toBeChecked({
      checked: localStg.context_menu,
    });
    await expect(page.getByLabel(optionLabels.context_menu_match)).toBeChecked({
      checked: localStg.context_menu_match,
    });
    await expect(page.getByLabel(optionLabels.meta_buttons)).toBeChecked({
      checked: localStg.meta_buttons,
    });
    await expect(page.getByLabel(optionLabels.custom_resolver)).toBeChecked({
      checked: localStg.custom_resolver,
    });
    await expect(page.getByLabel(optionLabels.doi_resolver)).toHaveValue(localStg.doi_resolver);
    await expect(page.getByLabel(optionLabels.shortdoi_resolver)).toHaveValue(
      localStg.shortdoi_resolver
    );
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_autolink)
    ).toHaveValue(localStg.cr_autolink);
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_bubble)
    ).toHaveValue(localStg.cr_bubble);
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_context)
    ).toHaveValue(localStg.cr_context);
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_omnibox)
    ).toHaveValue(localStg.cr_omnibox);
    await expect(
      page.locator('#customResolverSubOptions').getByLabel(optionLabels.cr_history)
    ).toHaveValue(localStg.cr_history);
    await expect(page.getByLabel(optionLabels.auto_link)).toBeChecked({
      checked: localStg.auto_link,
    });
    await expect(page.getByLabel(optionLabels.auto_link_rewrite)).toBeChecked({
      checked: localStg.auto_link_rewrite,
    });
    await expect(page.getByLabel(optionLabels.autolink_exclusions)).toHaveValue(
      localStg.autolink_exclusions.join('\n')
    );
    await expect(page.getByLabel(optionLabels.sync_data)).toBeChecked({
      checked: localStg.sync_data,
    });
  });
});

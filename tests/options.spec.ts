import {test, expect} from './fixtures';
import {DisplayTheme, OmniboxTab, CustomResolverSelection} from '../src/lib/options';
import {getStorageValue, handbookDoi, handbookShortDoi} from './utils';

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

  test('set display theme', async ({page}) => {
    const themes = Object.values(DisplayTheme);
    const select = page.getByLabel('Color theme for pages:');
    const options = await select.getByRole('option').all();
    expect(options).toHaveLength(themes.length);
    for (const theme of themes.reverse()) {
      await select.selectOption(theme);
      await expect.poll(() => getStorageValue(page, 'theme')).toBe(theme);
      await expect(select).toHaveValue(theme);
    }
  });

  // TODO: omnibox.spec.ts to test open behavior
  test('set omnibox open behavior', async ({page}) => {
    const tabs = Object.values(OmniboxTab);
    const select = page.getByLabel('Omnibox entry should by default open result in:');
    const options = await select.getByRole('option').all();
    expect(options).toHaveLength(tabs.length);
    for (const tab of tabs.reverse()) {
      await select.selectOption(tab);
      await expect.poll(() => getStorageValue(page, 'omnibox_tab')).toBe(tab);
      await expect(select).toHaveValue(tab);
    }
  });

  test('toggle history', async ({page}) => {
    const checkbox = page.getByLabel('Retain history of DOIs');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggle history changes suboption visibility', async ({page}) => {
    const suboptionsContainer = page.locator('#historySubOptions');
    const checkbox = page.getByLabel('Retain history of DOIs');
    await checkbox.click();
    await expect(suboptionsContainer).toBeVisible();
    await checkbox.click();
    await expect(suboptionsContainer).toBeHidden();
  });

  test('toggle history saved entries dropdown behavior', async ({page}) => {
    await page.getByLabel('Retain history of DOIs').click();
    const checkbox = page.getByLabel('Only show saved entries in text input box drop-downs');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_showsave')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_showsave')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggle history show titles behavior', async ({page}) => {
    await page.getByLabel('Retain history of DOIs').click();
    const checkbox = page.getByLabel('Show titles instead of DOIs in text input box drop-downs');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_showtitles')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'history_showtitles')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  // TODO: Revise test for optional permissions handling
  test('toggle history title auto-fetch behavior', async ({page}) => {
    await page.getByLabel('Retain history of DOIs').click();
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

    await page.getByLabel('Retain history of DOIs').click();
    const input = page.getByLabel('Number of history entries to retain (1 ≤ N ≤ 5000)');
    await testLength(1, 1);
    await testLength(0, 1);
    await testLength(-1, 1);
    await testLength(50, 50);
    await testLength(5000, 5000);
    await testLength(5001, 5000);
    await testLength(21.1, 21);
  });

  test('toggle context menu', async ({page}) => {
    const checkbox = page.getByLabel('Enable right-click context menu for selected text');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu')).toBe(false);
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu')).toBe(true);
    await expect(checkbox).toBeChecked();
  });

  test('toggle context menu selection awareness', async ({page}) => {
    const checkbox = page.getByLabel('Only show context menu entry if a DOI is selected');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu_match')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'context_menu_match')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggling context menu affects selection awareness', async ({page}) => {
    const cmmCheckbox = page.getByLabel('Only show context menu entry if a DOI is selected');
    await cmmCheckbox.click();
    const cmCheckbox = page.getByLabel('Enable right-click context menu for selected text');
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

  test('toggle QR and citation buttons', async ({page}) => {
    const checkbox = page.getByLabel('Enable additional features in the browser action bubble');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'meta_buttons')).toBe(false);
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'meta_buttons')).toBe(true);
    await expect(checkbox).toBeChecked();
  });

  test('toggle custom resolver', async ({page}) => {
    const checkbox = page.getByLabel('Use a custom DOI resolver');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'custom_resolver')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'custom_resolver')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggle custom resolver changes suboption visibility', async ({page}) => {
    const suboptionsContainer = page.locator('#customResolverSubOptions');
    const checkbox = page.getByLabel('Use a custom DOI resolver');
    await checkbox.click();
    await expect(suboptionsContainer).toBeVisible();
    await checkbox.click();
    await expect(suboptionsContainer).toBeHidden();
  });

  test('set custom DOI resolver', async ({page}) => {
    await page.getByLabel('Use a custom DOI resolver').click();
    const input = page.getByLabel('URL for DOI resolver');
    await input.fill('https://mydoi/');
    await expect.poll(() => getStorageValue(page, 'doi_resolver')).toBe('https://mydoi/');
    const preview = page.locator('#doiResolverOutput');
    await expect(preview).toContainText(`/mydoi/${handbookDoi}`);
  });

  test('set custom ShortDOI resolver', async ({page}) => {
    await page.getByLabel('Use a custom DOI resolver').click();
    const input = page.getByLabel('URL for ShortDOI resolver');
    await input.fill('https://mydoi/');
    await expect.poll(() => getStorageValue(page, 'shortdoi_resolver')).toBe('https://mydoi/');
    const preview = page.locator('#shortDoiResolverOutput');
    await expect(preview).toContainText(`/mydoi/${handbookShortDoi.replace('10/', '')}`);
  });

  test('set custom resolver choices (non-selectable)', async ({page}) => {
    await page.getByLabel('Use a custom DOI resolver').click();
    const container = page.locator('#customResolverSubOptions');
    for (const [label, key] of [
      ['Autolink', 'cr_autolink'],
      ['Context Menu', 'cr_context'],
      ['Omnibox', 'cr_omnibox'],
      ['History Page', 'cr_history'],
    ]) {
      const select = container.getByLabel(label);
      await select.selectOption(CustomResolverSelection.Default);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Default);
      await select.selectOption(CustomResolverSelection.Custom);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Custom);
    }
  });

  test('set custom resolver choices (selectable)', async ({page}) => {
    await page.getByLabel('Use a custom DOI resolver').click();
    const container = page.locator('#customResolverSubOptions');
    for (const [label, key] of [['Popup', 'cr_bubble']]) {
      const select = container.getByLabel(label);
      await select.selectOption(CustomResolverSelection.Default);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Default);
      await select.selectOption(CustomResolverSelection.Custom);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Custom);
      await select.selectOption(CustomResolverSelection.Selectable);
      await expect.poll(() => getStorageValue(page, key)).toBe(CustomResolverSelection.Selectable);
    }
  });

  test('toggle autolink', async ({page}) => {
    const checkbox = page.getByLabel('Automatically turn DOI codes on web pages into links');
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'auto_link')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'auto_link')).toBe(false);
    await expect(checkbox).not.toBeChecked();
  });

  test('toggle autolink changes suboption visibility', async ({page}) => {
    const suboptionsContainer = page.locator('#autolinkSubOptions');
    const checkbox = page.getByLabel('Automatically turn DOI codes on web pages into links');
    await checkbox.click();
    await expect(suboptionsContainer).toBeVisible();
    await checkbox.click();
    await expect(suboptionsContainer).toBeHidden();
  });

  test('toggle autolink rewrite', async ({page}) => {
    await page.getByLabel('Automatically turn DOI codes on web pages into links').click();
    const checkbox = page.getByLabel(
      'Rewrite existing doi.org and dx.doi.org links to use the Custom DOI Resolver'
    );
    await expect(checkbox).toBeHidden();
    await page.getByLabel('Use a custom DOI resolver').click();
    await expect(checkbox).toBeVisible();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'auto_link_rewrite')).toBe(true);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect.poll(() => getStorageValue(page, 'auto_link_rewrite')).toBe(false);
    await expect(checkbox).not.toBeChecked();
    await page.getByLabel('Use a custom DOI resolver').click();
    await expect(checkbox).toBeHidden();
  });

  test('toggle autolink exclusions', async ({page}) => {
    await page.getByLabel('Automatically turn DOI codes on web pages into links').click();
    const textarea = page.getByLabel('Exclude URLs and URL patterns from autolink');
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
});

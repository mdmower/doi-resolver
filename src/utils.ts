/**
 * @license Apache-2.0
 */
import {logError} from './lib/logger';
import {DisplayTheme, getDefaultOptions, getOptions} from './lib/options';
import {isRecord} from './lib/utils';

/**
 * Apply theme to page
 * @param win Window
 * @param theme Theme to apply
 */
export async function applyTheme(win: Window, theme?: DisplayTheme): Promise<void> {
  if (theme === undefined) {
    const stg = await getOptions('local', ['theme']);
    theme = stg.theme ?? getDefaultOptions()['theme'];
  }

  if (
    theme === DisplayTheme.Dark ||
    (theme === DisplayTheme.System && win.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    win.document.documentElement.setAttribute('data-bs-theme', DisplayTheme.Dark);
  } else {
    win.document.documentElement.setAttribute('data-bs-theme', DisplayTheme.Light);
  }
}

/**
 * Parse titles
 * @param val The raw titles which may include HTML
 */
export function parseTitles(val?: unknown): Record<string, string | undefined> | undefined {
  if (!isRecord(val)) {
    return;
  }

  return Object.keys(val).reduce<Record<string, string | undefined>>((titles, doi) => {
    let title: string | undefined;

    const rawTitle = val[doi];
    if (typeof rawTitle === 'string') {
      try {
        const container = document.createElement('div');
        container.innerHTML = rawTitle;
        let firstChild = container.firstElementChild;
        while (firstChild) {
          if (firstChild.tagName === 'SUBTITLE' && firstChild.textContent) {
            container.replaceChild(
              document.createTextNode(` - ${firstChild.textContent}`),
              firstChild
            );
          } else if (firstChild.tagName === 'ALT-TITLE' || !firstChild.textContent?.trim()) {
            container.removeChild(firstChild);
          } else {
            container.replaceChild(document.createTextNode(firstChild.textContent), firstChild);
          }
          firstChild = container.firstElementChild;
        }

        title = container.textContent?.replace(/\s{2,}/g, ' ').trim();
      } catch (ex) {
        logError('Failed to parse title', ex);
      }
    }

    titles[doi] = title;
    return titles;
  }, {});
}
